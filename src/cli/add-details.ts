// Adds the on-screen credit and place name to a batch published before they existed (2026-10).
//   npm run add-details -- --batch 2026-10 [--report out/details-2026-10.tsv]
// Only optional manifest fields change; the photos don't. Commons is asked for each file's Artist,
// Credit and coordinates again, so a credit fixed on Commons since publishing is picked up too.
import { parseArgs } from "node:util";
import { fetchFileInfo, type CommonsFile } from "../commons.ts";
import { displayCredit } from "../credit.ts";
import { readJson, writeText } from "../io.ts";
import { rewriteBatchManifest } from "../manifest.ts";
import { batchManifestPath, sitePath } from "../paths.ts";
import { PlaceLookup } from "../places.ts";
import { BatchManifest, type Item } from "../schema.ts";

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

/** The item with a fresh credit and place. A file Commons no longer has keeps what it had. */
async function withDetails(item: Item, file: CommonsFile | undefined, places: PlaceLookup): Promise<{ item: Item; problem: string | null }> {
  if (!file) return { item, problem: "not on Commons any more" };
  const { credit, place, ...rest } = item;
  const onScreen = displayCredit(file.author, file);
  const foundPlace = await places.find(file.latitude, file.longitude);
  const updated: Item = {
    ...rest,
    ...(onScreen.credit !== null && { credit: onScreen.credit }),
    ...(foundPlace && { place: foundPlace }),
  };
  return { item: updated, problem: onScreen.problem };
}

/** One line per photo, for checking every credit and place by eye. */
function reportLine(item: Item, problem: string | null): string {
  return [item.id, item.credit ?? `— (${problem})`, item.place ?? "—", item.author.slice(0, 120)].join("\t");
}

async function main(): Promise<void> {
  const { batch, report } = readOptions();
  const manifest = readJson(sitePath(batchManifestPath(batch)), BatchManifest);
  const filesById = await fetchFilesById(manifest.items);
  const places = new PlaceLookup();

  const items: Item[] = [];
  const lines: string[] = [];
  for (const item of manifest.items) {
    const result = await withDetails(item, filesById.get(item.id), places);
    items.push(result.item);
    lines.push(reportLine(result.item, result.problem));
  }
  places.save();
  if (report) writeText(report, lines.join("\n") + "\n");

  rewriteBatchManifest(batch, manifest, items);
  const credited = items.filter((item) => item.credit).length;
  const placed = items.filter((item) => item.place).length;
  console.log(`${batch}: ${credited}/${items.length} with an on-screen credit, ${placed} with a place`);
}

await main();
