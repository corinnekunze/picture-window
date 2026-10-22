// Monthly step 2, after review: render the approved photos and write the manifests.
//   npm run publish:batch -- --title "Approve batch 2026-11" --body-file issue.md
// Images go to out/batch-*/ and their 4K videos to out/videos-*/; the workflow uploads both releases before it commits
// docs/, so TVs never see a manifest whose images are missing.
import { readFileSync, rmSync } from "node:fs";
import { parseArgs } from "node:util";
import { OUT_HEIGHT, OUT_WIDTH } from "../config.ts";
import { parseApprovedBatch, parsePhotoIds } from "../approval.ts";
import { readJson, sha256Hex, writeJson, writeText } from "../io.ts";
import { readRevokedIds, recordDecisions, type Decision } from "../ledger.ts";
import { livePhotos, readIndex, rollIndex } from "../manifest.ts";
import { PATHS, batchManifestPath, photoFileName, releaseAssetUrl, releaseTag, sitePath, themeName, videoAssetUrl, videoFileName, videoReleaseTag } from "../paths.ts";
import { renderPhoto } from "../photo.ts";
import { BatchManifest, Staging, type Candidate, type Item, type Video } from "../schema.ts";
import { encodeStillVideo } from "../video.ts";
import { writeCreditsPage, writeEmptyReviewPage, writeLandingPage } from "../site.ts";
import { writeTheme } from "../theme.ts";

interface Approval {
  staging: Staging;
  approved: Candidate[];
  rejectedIds: Set<string>;
}

interface RenderResult {
  photos: Item[];
  decisions: Decision[];
}

/** Matches the approval issue to the staged batch; refuses to publish on any mismatch. */
function readApproval(): Approval {
  const { values } = parseArgs({ options: { title: { type: "string" }, "body-file": { type: "string" } } });
  const staging = readJson(PATHS.staging, Staging);
  const approvedBatch = parseApprovedBatch(values.title ?? "");
  if (approvedBatch !== staging.batch) {
    throw new Error(`The approval is for "${approvedBatch}", but the staged batch is ${staging.batch}. Nothing published.`);
  }

  const issueBody = values["body-file"] ? readFileSync(values["body-file"], "utf8") : "";
  const listedIds = new Set(parsePhotoIds(issueBody));
  const rejectedIds = new Set(staging.candidates.map((candidate) => candidate.id).filter((photoId) => listedIds.has(photoId)));
  const approved = staging.candidates.filter((candidate) => !rejectedIds.has(candidate.id));
  return { staging, approved, rejectedIds };
}

function toItem(candidate: Candidate, batch: string, webp: Buffer, sha256: string, video: Video | undefined): Item {
  return {
    id: candidate.id,
    title: candidate.title,
    author: candidate.author,
    license: candidate.license,
    licenseUrl: candidate.licenseUrl,
    sourceUrl: candidate.sourceUrl,
    ...(candidate.credit && { credit: candidate.credit }),
    ...(candidate.place && { place: candidate.place }),
    category: candidate.category,
    url: releaseAssetUrl(batch, photoFileName(candidate.id)),
    width: OUT_WIDTH,
    height: OUT_HEIGHT,
    bytes: webp.length,
    sha256,
    ...(video && { video }),
  };
}

/**
 * Writes the photo's 4K video next to its image. The video is optional in the feed, so a failed
 * encode leaves it out and keeps the photo.
 */
async function writeVideo(photoId: string, batch: string, webp: Buffer): Promise<Video | undefined> {
  try {
    const { mp4, sha256 } = await encodeStillVideo(webp);
    writeText(`${PATHS.out}/${videoReleaseTag(batch)}/${videoFileName(photoId)}`, mp4);
    return { url: videoAssetUrl(batch, videoFileName(photoId)), bytes: mp4.length, sha256 };
  } catch (error) {
    console.warn(`No video for ${photoId}: ${(error as Error).message}`);
    return undefined;
  }
}

/** Renders every approved photo into `imageDir`. A photo that fails is left out, never published half-made. */
async function renderApproved(approval: Approval, imageDir: string): Promise<RenderResult> {
  const result: RenderResult = { photos: [], decisions: [] };
  for (const [position, candidate] of approval.approved.entries()) {
    try {
      const { webp, sha256 } = await renderPhoto(candidate);
      writeText(`${imageDir}/${photoFileName(candidate.id)}`, webp);
      const video = await writeVideo(candidate.id, approval.staging.batch, webp);
      result.photos.push(toItem(candidate, approval.staging.batch, webp, sha256, video));
      result.decisions.push({ id: candidate.id, decision: "approved" });
      console.log(`[${position + 1}/${approval.approved.length}] ${candidate.id} ${(webp.length / 1e6).toFixed(1)} MB`);
    } catch (error) {
      const reason = `render failed: ${(error as Error).message}`;
      result.decisions.push({ id: candidate.id, decision: "rejected", reason });
      console.warn(`Skipped ${candidate.id}: ${reason}`);
    }
  }
  return result;
}

/** Theme photos: the batch minus anything flagged as possibly suggestive. */
function themePhotos(approval: Approval, photos: Item[]): Item[] {
  const flaggedIds = new Set(approval.staging.candidates.filter((candidate) => candidate.flags.length).map((candidate) => candidate.id));
  return photos.filter((photo) => !flaggedIds.has(photo.id));
}

/** Writes the batch manifest and the rolled index; returns the batches that left the window. */
function writeManifests(batch: string, photos: Item[], now: Date): string[] {
  const manifestPath = batchManifestPath(batch);
  writeJson(sitePath(manifestPath), BatchManifest.parse({ schema: 1, batch, published: now.toISOString(), items: photos }));

  const entry = {
    id: batch,
    manifest: manifestPath,
    sha256: sha256Hex(readFileSync(sitePath(manifestPath))),
    count: photos.length,
    theme: releaseAssetUrl(batch, `${themeName(batch)}.zip`),
  };
  const { index, dropped } = rollIndex(readIndex(), entry, readRevokedIds(), now);
  writeJson(PATHS.index, index);
  for (const droppedBatch of dropped) rmSync(sitePath(batchManifestPath(droppedBatch)), { force: true });

  writeCreditsPage(livePhotos(index), index.published);
  return dropped;
}

async function main(): Promise<void> {
  const approval = readApproval();
  const batch = approval.staging.batch;
  console.log(`${approval.approved.length} approved, ${approval.rejectedIds.size} rejected`);

  const imageDir = `${PATHS.out}/${releaseTag(batch)}`;
  rmSync(PATHS.out, { recursive: true, force: true });

  const { photos, decisions } = await renderApproved(approval, imageDir);
  if (!photos.length) throw new Error("No photos rendered. Nothing published.");

  const themeIds = writeTheme(themePhotos(approval, photos), imageDir, `${PATHS.out}/${themeName(batch)}`);
  const dropped = writeManifests(batch, photos, new Date());
  writeText(`${PATHS.out}/dropped.txt`, dropped.map(releaseTag).join("\n"));
  writeLandingPage();
  writeEmptyReviewPage();

  const rejectedDecisions: Decision[] = [...approval.rejectedIds].map((photoId) => ({ id: photoId, decision: "rejected", reason: "review" }));
  recordDecisions([...rejectedDecisions, ...decisions]);
  rmSync(PATHS.staging, { force: true });
  console.log(`Published ${photos.length} photos as ${releaseTag(batch)}; ${themeIds.length} in the theme; dropped ${dropped.join(", ") || "none"}`);
}

await main();
