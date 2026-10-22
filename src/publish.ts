// Monthly step 2, after review: render the approved photos and write the manifests.
//   npx tsx src/publish.ts --title "Approve batch 2026-11" --body-file issue.md
// Writes images to out/batch-<id>/ and the theme to out/theme-<id>/; the workflow uploads
// those to a GitHub Release before committing docs/, so TVs never see a manifest whose
// images are missing.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { OUT_HEIGHT, OUT_WIDTH, REPO, THEME_CONFIG, THEME_SIZE, WEBP_QUALITY } from "./config.ts";
import { getWithRetry, sizedUrl } from "./commons.ts";
import { crop169 } from "./filters.ts";
import { liveItems, parseApprovalTitle, parseRejects, readIndex, rollIndex, sha256 } from "./manifest.ts";
import { renderCredits, renderLanding, renderNothingToReview } from "./pages.ts";
import { BatchManifest, Staging, type Item, type SeenEntry } from "./schema.ts";
import { PATHS, appendSeen, readJson, readRevoked, writeJson, writeText } from "./state.ts";

sharp.cache(false);

const { values } = parseArgs({ options: { title: { type: "string" }, "body-file": { type: "string" } } });
const staging = readJson(PATHS.staging, Staging);
const approvedBatch = parseApprovalTitle(values.title ?? "");
if (approvedBatch !== staging.batch) {
  throw new Error(`The approval is for "${approvedBatch}", but the staged batch is ${staging.batch}. Nothing published.`);
}
const rejects = new Set(parseRejects(values["body-file"] ? readFileSync(values["body-file"], "utf8") : ""));
const approved = staging.candidates.filter((c) => !rejects.has(c.id));
console.log(`${approved.length} approved, ${rejects.size} rejected`);

const tag = `batch-${staging.batch}`;
const imageDir = `${PATHS.out}/${tag}`;
rmSync(PATHS.out, { recursive: true, force: true });
mkdirSync(imageDir, { recursive: true });

const items: Item[] = [];
const decisions: Omit<SeenEntry, "at">[] = staging.candidates.filter((c) => rejects.has(c.id)).map((c) => ({ id: c.id, decision: "rejected", reason: "review" }));
for (const [n, c] of approved.entries()) {
  // Download a copy big enough that the 16:9 crop is still at least 4K.
  const needWidth = Math.ceil(OUT_WIDTH * (c.width / crop169(c.width, c.height).width));
  try {
    const source = Buffer.from(await (await getWithRetry(sizedUrl(c, needWidth))).arrayBuffer());
    const webp = await sharp(source, { limitInputPixels: false })
      .rotate()
      .resize(OUT_WIDTH, OUT_HEIGHT, { fit: "cover", position: sharp.strategy.attention })
      .webp({ quality: WEBP_QUALITY, effort: 5 })
      .toBuffer();
    writeFileSync(`${imageDir}/${c.id}.webp`, webp);
    items.push({
      id: c.id, title: c.title, author: c.author, license: c.license, licenseUrl: c.licenseUrl, sourceUrl: c.sourceUrl,
      category: c.category, url: `https://github.com/${REPO}/releases/download/${tag}/${c.id}.webp`,
      width: OUT_WIDTH, height: OUT_HEIGHT, bytes: webp.length, sha256: sha256(webp),
    });
    decisions.push({ id: c.id, decision: "approved" });
    console.log(`[${n + 1}/${approved.length}] ${c.id} ${(webp.length / 1e6).toFixed(1)} MB`);
  } catch (error) {
    // Left out of the batch; never published half-made.
    decisions.push({ id: c.id, decision: "rejected", reason: `render failed: ${(error as Error).message}` });
    console.warn(`Skipped ${c.id}: ${(error as Error).message}`);
  }
}
if (!items.length) throw new Error("No photos rendered. Nothing published.");

// CleanYourTV theme: the first photos of the batch (flagged ones were sorted to the top for review, so skip those).
const themeDir = `${PATHS.out}/theme-${staging.batch}`;
mkdirSync(`${themeDir}/wallpapers`, { recursive: true });
writeFileSync(`${themeDir}/config.json`, JSON.stringify(THEME_CONFIG, null, 2) + "\n");
const themePicks = items.filter((i) => !staging.candidates.find((c) => c.id === i.id)?.flags.length).slice(0, THEME_SIZE);
for (const item of themePicks) copyFileSync(`${imageDir}/${item.id}.webp`, `${themeDir}/wallpapers/${item.id}.webp`);

const now = new Date();
const manifest = BatchManifest.parse({ schema: 1, batch: staging.batch, published: now.toISOString(), items });
const manifestPath = `batches/${staging.batch}.json`;
writeJson(`${PATHS.docs}/${manifestPath}`, manifest);
const { index, dropped } = rollIndex(readIndex(), {
  id: staging.batch,
  manifest: manifestPath,
  sha256: sha256(readFileSync(`${PATHS.docs}/${manifestPath}`)),
  count: items.length,
  theme: `https://github.com/${REPO}/releases/download/${tag}/theme-${staging.batch}.zip`,
}, readRevoked(), now);
writeJson(PATHS.index, index);
for (const id of dropped) rmSync(`${PATHS.docs}/batches/${id}.json`, { force: true });
writeText(`${PATHS.out}/dropped.txt`, dropped.map((id) => `batch-${id}`).join("\n"));

writeText(`${PATHS.docs}/credits.html`, renderCredits(liveItems(index), index.published));
writeText(`${PATHS.docs}/index.html`, renderLanding());
writeText(`${PATHS.docs}/review/index.html`, renderNothingToReview());
appendSeen(decisions);
if (existsSync(PATHS.staging)) rmSync(PATHS.staging);
console.log(`Published ${items.length} photos as ${tag}; ${themePicks.length} in the theme; dropped ${dropped.join(", ") || "none"}`);
