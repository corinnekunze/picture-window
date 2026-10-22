// Monthly step 1: find new candidates and put them up for review.
//   npx tsx src/stage.ts [--count 450] [--batch 2026-11] [--max-scan 6000]
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { MAX_CATEGORY_SHARE, NSFW_FLAG, NSFW_REJECT, STAGE_COUNT } from "./config.ts";
import { fileInfo, getWithRetry, listFeatured } from "./commons.ts";
import { balance, check, cleanTitle, stripHtml } from "./filters.ts";
import { renderReviewPage } from "./pages.ts";
import { nsfwScore } from "./safety.ts";
import type { Candidate, SeenEntry, Staging } from "./schema.ts";
import { PATHS, appendSeen, batchId, readSeen, writeJson, writeText } from "./state.ts";

const { values } = parseArgs({
  options: {
    count: { type: "string", default: String(STAGE_COUNT) },
    batch: { type: "string", default: batchId() },
    "max-scan": { type: "string", default: "6000" },
  },
});
const count = Number(values.count);
const maxScan = Number(values["max-scan"]);

if (existsSync(PATHS.staging)) {
  console.log(`A batch is still waiting for review (${PATHS.staging}). Approve or delete it before staging another.`);
  process.exit(0);
}

const seen = readSeen();
const ids = (await listFeatured()).filter((id) => !seen.has(`wmc-${id}`));
console.log(`${ids.length} Featured Pictures not evaluated yet`);

const passed: Candidate[] = [];
const decisions: Omit<SeenEntry, "at">[] = [];
const cap = Math.floor(count * MAX_CATEGORY_SHARE);
/** How many we could stage right now without breaking the category cap. */
const stageable = () => {
  const per = new Map<string, number>();
  for (const c of passed) per.set(c.category, (per.get(c.category) ?? 0) + 1);
  return [...per.values()].reduce((sum, n) => sum + Math.min(n, cap), 0);
};

let scanned = 0;
for (let i = 0; i < ids.length && scanned < maxScan && stageable() < count; i += 100) {
  const files = await fileInfo(ids.slice(i, i + 100));
  for (const file of files) {
    scanned++;
    const id = `wmc-${file.pageId}`;
    const verdict = check(file);
    if (!verdict.ok) {
      decisions.push({ id, decision: "filtered", reason: verdict.reason });
      continue;
    }
    let nsfw: number;
    try {
      nsfw = await nsfwScore(Buffer.from(await (await getWithRetry(file.thumbUrl)).arrayBuffer()));
    } catch (error) {
      console.warn(`Skipping ${id} for now: ${(error as Error).message}`);
      continue; // not recorded, so it is tried again next month
    }
    if (nsfw >= NSFW_REJECT) {
      decisions.push({ id, decision: "nsfw", reason: nsfw.toFixed(3) });
      continue;
    }
    passed.push({
      id,
      category: verdict.category,
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
    });
  }
  console.log(`scanned ${scanned}, ${passed.length} passed, ${stageable()} stageable`);
}

const candidates = balance(passed, count, MAX_CATEGORY_SHARE);
// Passed but not staged this month: left unrecorded so a later batch can use them.
for (const c of candidates) decisions.push({ id: c.id, decision: "staged" });
appendSeen(decisions);

if (!candidates.length) {
  console.log("Nothing new to stage.");
  process.exit(0);
}

// Possibly suggestive photos first, so they get the closest look.
candidates.sort((a, b) => b.nsfw - a.nsfw);
const staging: Staging = { batch: values.batch!, staged: new Date().toISOString(), candidates };
writeJson(PATHS.staging, staging);
writeText(`${PATHS.docs}/review/index.html`, renderReviewPage(staging));

const perCategory = Object.groupBy(candidates, (c) => c.category);
console.log(`Staged ${candidates.length} for ${staging.batch}:`, Object.fromEntries(Object.entries(perCategory).map(([k, v]) => [k, v!.length])));
