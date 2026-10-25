// Adds the on-screen credit, place name and about line to a batch published before they existed (2026-10).
//   npm run add-details -- --batch 2026-10 [--report out/details-2026-10.tsv]
// Only optional manifest fields change; the photos don't. Commons is asked for each file's Artist,
// Credit and coordinates again, so a credit fixed on Commons since publishing is picked up too.
import { parseArgs } from "node:util";
import { describeFiles, type AboutResult } from "../about.ts";
import { fetchFileInfo, type CommonsFile } from "../commons.ts";
import { displayCredit } from "../credit.ts";
import { readJson, writeText } from "../io.ts";
import { readIndex, rewriteBatchManifest } from "../manifest.ts";
import { batchManifestPath, sitePath } from "../paths.ts";
import { PlaceLookup } from "../places.ts";
import { BatchManifest, type Item } from "../schema.ts";
import { writePublicPages } from "../site.ts";

interface Options {
  batch: string;
  report: string | undefined;
}

function readOptions(): Options {
  const { values } = parseArgs({ options: { batch: { type: "string" }, report: { type: "string" } } });
  if (!values.batch || !/^\d{4}-\d{2}$/.test(values.batch)) throw new Error("Pass --batch YYYY-MM.");
  return { batch: values.batch, report: values.report };
}

async function fetchFilesById(items: Item[]): Promise<Map<string, CommonsFile>> {
  const pageIds = items.map((item) => Number(item.id.replace("wmc-", "")));
  const files = await fetchFileInfo(pageIds);
  return new Map(files.map((file) => [`wmc-${file.pageId}`, file]));
}

interface Details {
  file: CommonsFile | undefined;
  about: AboutResult | undefined;
}

/** The item with a fresh credit, place and about line. A file Commons no longer has keeps what it had. */
async function withDetails(item: Item, details: Details, places: PlaceLookup): Promise<{ item: Item; problems: string[] }> {
  const { file, about } = details;
  if (!file || !about) return { item, problems: ["not on Commons any more"] };
  const { credit, place, about: previousAbout, ...rest } = item;
  const onScreen = displayCredit(file.author, file);
  const foundPlace = await places.find(file.latitude, file.longitude);
  const updated: Item = {
    ...rest,
    ...(onScreen.credit !== null && { credit: onScreen.credit }),
    ...(foundPlace && { place: foundPlace }),
    ...(about.about !== null && { about: about.about }),
  };
  return { item: updated, problems: [onScreen.problem, about.problem].filter((problem) => problem !== null) };
}

/** One line per photo, for checking every credit, place and about line by eye. */
function reportLine(item: Item, problems: string[]): string {
  return [item.id, item.credit ?? "—", item.place ?? "—", item.about ?? "—", problems.join("; ")].join("\t");
}

async function main(): Promise<void> {
  const { batch, report } = readOptions();
  const manifest = readJson(sitePath(batchManifestPath(batch)), BatchManifest);
  const filesById = await fetchFilesById(manifest.items);
  const aboutByPageId = await describeFiles(manifest.items.map((item) => Number(item.id.replace("wmc-", ""))));
  const places = new PlaceLookup();

  const items: Item[] = [];
  const lines: string[] = [];
  for (const item of manifest.items) {
    const details = { file: filesById.get(item.id), about: aboutByPageId.get(Number(item.id.replace("wmc-", ""))) };
    const result = await withDetails(item, details, places);
    items.push(result.item);
    lines.push(reportLine(result.item, result.problems));
  }
  places.save();
  if (report) writeText(report, lines.join("\n") + "\n");

  rewriteBatchManifest(batch, manifest, items);
  writePublicPages(readIndex()!);
  const credited = items.filter((item) => item.credit).length;
  const placed = items.filter((item) => item.place).length;
  const described = items.filter((item) => item.about).length;
  console.log(`${batch}: ${credited}/${items.length} with an on-screen credit, ${placed} with a place, ${described} with an about line`);
}

await main();
