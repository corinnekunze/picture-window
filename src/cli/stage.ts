// Monthly step 1: find new candidates and put them up for review.
//   npm run stage -- [--count 450] [--batch 2026-11] [--max-scan 6000]
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { MAX_CATEGORY_SHARE, NSFW_FLAG, NSFW_REJECT, STAGE_COUNT, type Category } from "../config.ts";
import { downloadBuffer, fetchFileInfo, listFeaturedPageIds, type CommonsFile } from "../commons.ts";
import { balanceByCategory, checkFile, cleanTitle, pickableCount, stripHtml } from "../filters.ts";
import { writeJson } from "../io.ts";
import { displayCredit } from "../credit.ts";
import { batchIdFor, readLedger, recordDecisions, type Decision } from "../ledger.ts";
import { PATHS } from "../paths.ts";
import { PlaceLookup } from "../places.ts";
import { nsfwScore } from "../safety.ts";
import type { Candidate, Staging } from "../schema.ts";
import { writeReviewPage } from "../site.ts";

const SCAN_CHUNK = 100;

interface Options {
  count: number;
  batch: string;
  maxScan: number;
}

interface ScanResult {
  passed: Candidate[];
  decisions: Decision[];
}

function readOptions(): Options {
  const { values } = parseArgs({
    options: {
      count: { type: "string", default: String(STAGE_COUNT) },
      batch: { type: "string", default: batchIdFor() },
      "max-scan": { type: "string", default: "6000" },
    },
  });
  return { count: Number(values.count), batch: values.batch, maxScan: Number(values["max-scan"]) };
}

async function listUnevaluatedPageIds(): Promise<number[]> {
  const ledger = readLedger();
  const pageIds = await listFeaturedPageIds();
  return pageIds.filter((pageId) => !ledger.has(`wmc-${pageId}`));
}

function toCandidate(file: CommonsFile, category: Category, nsfw: number, place: string | null): Candidate {
  const onScreen = displayCredit(file.author, file);
  return {
    id: `wmc-${file.pageId}`,
    category,
    title: cleanTitle(file.title),
    author: stripHtml(file.author) || "Unknown",
    license: file.license,
    licenseUrl: file.licenseUrl,
    sourceUrl: file.sourceUrl,
    width: file.width,
    height: file.height,
    originalUrl: file.originalUrl,
    thumbUrl: file.thumbUrl,
    nsfw: Number(nsfw.toFixed(3)),
    flags: nsfw >= NSFW_FLAG ? ["possibly suggestive"] : [],
    ...(onScreen.credit !== null ? { credit: onScreen.credit } : { creditProblem: onScreen.problem }),
    ...(place && { place }),
  };
}

/** Runs the filters and the safety model on one file; adds the result to `scan`. */
async function evaluateFile(file: CommonsFile, scan: ScanResult, places: PlaceLookup): Promise<void> {
  const photoId = `wmc-${file.pageId}`;
  const verdict = checkFile(file);
  if (!verdict.ok) {
    scan.decisions.push({ id: photoId, decision: "filtered", reason: verdict.reason });
    return;
  }

  let nsfw: number;
  try {
    nsfw = await nsfwScore(await downloadBuffer(file.thumbUrl));
  } catch (error) {
    // Not recorded, so the file is tried again next month.
    console.warn(`Skipping ${photoId} for now: ${(error as Error).message}`);
    return;
  }

  if (nsfw >= NSFW_REJECT) {
    scan.decisions.push({ id: photoId, decision: "nsfw", reason: nsfw.toFixed(3) });
    return;
  }
  scan.passed.push(toCandidate(file, verdict.category, nsfw, await places.find(file.latitude, file.longitude)));
}

/** Evaluates files in order until enough could be staged within the category cap. */
async function scanForCandidates(pageIds: number[], options: Options): Promise<ScanResult> {
  const scan: ScanResult = { passed: [], decisions: [] };
  const places = new PlaceLookup();
  const enoughPassed = () => pickableCount(scan.passed, options.count, MAX_CATEGORY_SHARE) >= options.count;
  let scanned = 0;

  for (let start = 0; start < pageIds.length; start += SCAN_CHUNK) {
    if (scanned >= options.maxScan || enoughPassed()) break;
    const files = await fetchFileInfo(pageIds.slice(start, start + SCAN_CHUNK));
    for (const file of files) await evaluateFile(file, scan, places);
    scanned += files.length;
    console.log(`scanned ${scanned}, ${scan.passed.length} passed`);
  }
  places.save();
  return scan;
}

function summarize(candidates: Candidate[]): Record<string, number> {
  const perCategory = Map.groupBy(candidates, (candidate) => candidate.category);
  return Object.fromEntries([...perCategory].map(([category, members]) => [category, members.length]));
}

async function main(): Promise<void> {
  if (existsSync(PATHS.staging)) {
    console.log(`A batch is still waiting for review (${PATHS.staging}). Approve or delete it before staging another.`);
    return;
  }

  const options = readOptions();
  const pageIds = await listUnevaluatedPageIds();
  console.log(`${pageIds.length} Featured Pictures not evaluated yet`);

  const scan = await scanForCandidates(pageIds, options);
  const candidates = balanceByCategory(scan.passed, options.count, MAX_CATEGORY_SHARE);
  // Files that passed but weren't staged stay unrecorded, so a later batch can use them.
  const stagedDecisions: Decision[] = candidates.map((candidate) => ({ id: candidate.id, decision: "staged" }));
  recordDecisions([...scan.decisions, ...stagedDecisions]);

  if (!candidates.length) {
    console.log("Nothing new to stage.");
    return;
  }

  // Possibly suggestive photos first, so they get the closest look.
  const staging: Staging = {
    batch: options.batch,
    staged: new Date().toISOString(),
    candidates: candidates.toSorted((left, right) => right.nsfw - left.nsfw),
  };
  writeJson(PATHS.staging, staging);
  writeReviewPage(staging);
  console.log(`Staged ${candidates.length} for ${staging.batch}:`, summarize(candidates));
}

await main();
