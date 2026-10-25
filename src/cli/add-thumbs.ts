// Adds photos-page thumbnails to a batch published before they existed (October 2026 was the first).
//   npm run add-thumbs -- --batch 2026-10
// Thumbnails go to out/thumbs-YYYY-MM/; the workflow uploads them to the batch's thumbnail release
// before it commits the photos page that shows them. The feed doesn't change: each image is
// downloaded from the release and checked against its hash. Revoked photos get none.
import { rmSync } from "node:fs";
import { parseArgs } from "node:util";
import { USER_AGENT } from "../config.ts";
import { readJson, sha256Hex, writeText } from "../io.ts";
import { readIndex } from "../manifest.ts";
import { PATHS, batchManifestPath, photoFileName, sitePath, thumbReleaseTag } from "../paths.ts";
import { renderThumbnail } from "../photo.ts";
import { BatchManifest, type Item } from "../schema.ts";
import { writeLandingPage, writePublicPages } from "../site.ts";

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

async function main(): Promise<void> {
  const batch = readBatchArgument();
  const index = readIndex();
  if (!index?.batches.some((entry) => entry.id === batch)) throw new Error(`Batch ${batch} isn't in the index. Nothing written.`);
  const manifest = readJson(sitePath(batchManifestPath(batch)), BatchManifest);
  const outDir = `${PATHS.out}/${thumbReleaseTag(batch)}`;
  rmSync(PATHS.out, { recursive: true, force: true });

  const revokedIds = new Set(index.revoked);
  const items = manifest.items.filter((item) => !revokedIds.has(item.id));
  for (const [position, item] of items.entries()) {
    writeText(`${outDir}/${photoFileName(item.id)}`, await renderThumbnail(await downloadPublishedImage(item)));
    if ((position + 1) % 50 === 0) console.log(`[${position + 1}/${items.length}] thumbnails`);
  }
  writePublicPages(index);
  writeLandingPage();
  console.log(`Made ${items.length} thumbnails for ${thumbReleaseTag(batch)}`);
}

await main();
