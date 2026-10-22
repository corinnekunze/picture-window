import { existsSync } from "node:fs";
import { KEEP_BATCHES } from "./config.ts";
import { readJson } from "./io.ts";
import { PATHS, sitePath } from "./paths.ts";
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

/** Every photo TVs should currently show: all batches in the index, minus revoked ones. */
export function livePhotos(index: Index): Item[] {
  const revoked = new Set(index.revoked);
  return index.batches
    .flatMap((batch) => readJson(sitePath(batch.manifest), BatchManifest).items)
    .filter((photo) => !revoked.has(photo.id));
}
