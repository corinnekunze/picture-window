import { existsSync, readFileSync } from "node:fs";
import { KEEP_BATCHES } from "./config.ts";
import { readJson, sha256Hex, writeJson } from "./io.ts";
import { PATHS, batchManifestPath, sitePath } from "./paths.ts";
import { BatchManifest, Index, type Item } from "./schema.ts";

export type IndexEntry = Index["batches"][number];

interface RolledIndex {
  index: Index;
  /** Batches that fell out of the window; their releases can be deleted. */
  dropped: string[];
}

/**
 * Adds a batch to the index (replacing one with the same ID), keeps the newest `keep`
 * batches, and sets the revoked list. Pass `entry: null` to only update revocations.
 */
export function rollIndex(previous: Index | null, entry: IndexEntry | null, revokedIds: string[], now: Date, keep = KEEP_BATCHES): RolledIndex {
  const otherBatches = (previous?.batches ?? []).filter((batch) => batch.id !== entry?.id);
  const allBatches = entry ? [...otherBatches, entry] : otherBatches;
  const newestFirst = allBatches.toSorted((left, right) => right.id.localeCompare(left.id));

  const index = Index.parse({
    schema: 1,
    published: now.toISOString(),
    batches: newestFirst.slice(0, keep),
    revoked: [...new Set(revokedIds)].sort(),
  });
  return { index, dropped: newestFirst.slice(keep).map((batch) => batch.id) };
}

export function readIndex(): Index | null {
  if (!existsSync(PATHS.index)) return null;
  return readJson(PATHS.index, Index);
}

/**
 * Rewrites a published batch's manifest with updated items (only ever adding optional fields) and
 * points the index at its new hash. Nothing else in the index changes.
 */
export function rewriteBatchManifest(batch: string, manifest: BatchManifest, items: Item[]): void {
  const manifestPath = batchManifestPath(batch);
  writeJson(sitePath(manifestPath), BatchManifest.parse({ ...manifest, items }));

  const index = readIndex();
  const entry = index?.batches.find((candidate) => candidate.id === batch);
  if (!index || !entry) throw new Error(`Batch ${batch} isn't in the index. Nothing written.`);
  const updatedEntry = { ...entry, sha256: sha256Hex(readFileSync(sitePath(manifestPath))) };
  writeJson(PATHS.index, rollIndex(index, updatedEntry, index.revoked, new Date()).index);
}

/** Every photo TVs should currently show: all batches in the index, minus revoked ones. */
export function livePhotos(index: Index): Item[] {
  const revoked = new Set(index.revoked);
  return index.batches
    .flatMap((batch) => readJson(sitePath(batch.manifest), BatchManifest).items)
    .filter((photo) => !revoked.has(photo.id));
}
