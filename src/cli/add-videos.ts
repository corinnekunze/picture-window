// Adds 4K videos to a batch published before videos existed (October 2026 was the first).
//   npm run add-videos -- --batch 2026-10
// Videos go to out/batch-YYYY-MM/; the workflow uploads them to the batch's existing release
// before it commits docs/, so TVs never see a manifest whose videos are missing. The photos
// themselves don't change: each image is downloaded from the release and checked against its hash.
import { readFileSync, rmSync } from "node:fs";
import { parseArgs } from "node:util";
import { USER_AGENT } from "../config.ts";
import { readJson, sha256Hex, writeJson, writeText } from "../io.ts";
import { readRevokedIds } from "../ledger.ts";
import { readIndex, rollIndex } from "../manifest.ts";
import { PATHS, batchManifestPath, releaseAssetUrl, releaseTag, sitePath, videoFileName } from "../paths.ts";
import { BatchManifest, type Item } from "../schema.ts";
import { encodeStillVideo } from "../video.ts";

interface Progress {
  added: number;
  skipped: number;
}

function readBatchArgument(): string {
  const { values } = parseArgs({ options: { batch: { type: "string" } } });
  if (!values.batch || !/^\d{4}-\d{2}$/.test(values.batch)) throw new Error("Pass --batch YYYY-MM.");
  return values.batch;
}

/** Downloads a published image and refuses it unless it matches the manifest exactly. */
async function downloadPublishedImage(item: Item): Promise<Buffer> {
  const response = await fetch(item.url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${item.url}`);
  const webp = Buffer.from(await response.arrayBuffer());
  if (sha256Hex(webp) !== item.sha256) throw new Error(`hash mismatch for ${item.url}`);
  return webp;
}

/** Returns the item with its video added, or unchanged if it already has one, is revoked, or fails. */
async function withVideo(item: Item, batch: string, revokedIds: Set<string>, outDir: string, progress: Progress): Promise<Item> {
  if (item.video || revokedIds.has(item.id)) return item;
  try {
    const { mp4, sha256 } = await encodeStillVideo(await downloadPublishedImage(item));
    writeText(`${outDir}/${videoFileName(item.id)}`, mp4);
    progress.added++;
    return { ...item, video: { url: releaseAssetUrl(batch, videoFileName(item.id)), bytes: mp4.length, sha256 } };
  } catch (error) {
    progress.skipped++;
    console.warn(`No video for ${item.id}: ${(error as Error).message}`);
    return item;
  }
}

/** Rewrites the batch manifest and points the index at its new hash. Nothing else in the index changes. */
function writeManifests(batch: string, manifest: BatchManifest, items: Item[]): void {
  const manifestPath = batchManifestPath(batch);
  writeJson(sitePath(manifestPath), BatchManifest.parse({ ...manifest, items }));

  const index = readIndex();
  const entry = index?.batches.find((candidate) => candidate.id === batch);
  if (!index || !entry) throw new Error(`Batch ${batch} isn't in the index. Nothing written.`);
  const updatedEntry = { ...entry, sha256: sha256Hex(readFileSync(sitePath(manifestPath))) };
  writeJson(PATHS.index, rollIndex(index, updatedEntry, index.revoked, new Date()).index);
}

async function main(): Promise<void> {
  const batch = readBatchArgument();
  const manifest = readJson(sitePath(batchManifestPath(batch)), BatchManifest);
  const revokedIds = new Set(readRevokedIds());
  const outDir = `${PATHS.out}/${releaseTag(batch)}`;
  rmSync(PATHS.out, { recursive: true, force: true });

  const progress: Progress = { added: 0, skipped: 0 };
  const items: Item[] = [];
  for (const [position, item] of manifest.items.entries()) {
    items.push(await withVideo(item, batch, revokedIds, outDir, progress));
    if ((position + 1) % 50 === 0) console.log(`[${position + 1}/${manifest.items.length}] ${progress.added} videos`);
  }
  if (!progress.added) {
    console.log("No videos to add. Nothing written.");
    return;
  }

  writeManifests(batch, manifest, items);
  console.log(`Added ${progress.added} videos to ${releaseTag(batch)}; ${progress.skipped} skipped`);
}

await main();
