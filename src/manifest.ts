import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { KEEP_BATCHES } from "./config.ts";
import { BatchManifest, Index } from "./schema.ts";
import { PATHS, readJson } from "./state.ts";

export const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

export type IndexEntry = Index["batches"][number];

/**
 * Adds a batch to the index (replacing one with the same ID) and keeps the newest `keep`.
 * Returns the new index and the batches that fell out of the window.
 */
export function rollIndex(previous: Index | null, entry: IndexEntry | null, revoked: string[], now: Date, keep = KEEP_BATCHES): { index: Index; dropped: string[] } {
  const all = (previous?.batches ?? []).filter((b) => b.id !== entry?.id);
  if (entry) all.push(entry);
  all.sort((a, b) => b.id.localeCompare(a.id));
  return {
    index: Index.parse({ schema: 1, published: now.toISOString(), batches: all.slice(0, keep), revoked: [...new Set(revoked)].sort() }),
    dropped: all.slice(keep).map((b) => b.id),
  };
}

export function readIndex(): Index | null {
  return existsSync(PATHS.index) ? readJson(PATHS.index, Index) : null;
}

/** Every live photo across the batches in the index, minus revoked ones. */
export function liveItems(index: Index): BatchManifest["items"] {
  const revoked = new Set(index.revoked);
  return index.batches.flatMap((b) => readJson(`${PATHS.docs}/${b.manifest}`, BatchManifest).items).filter((i) => !revoked.has(i.id));
}

/** IDs listed in an approval issue body, e.g. "reject:\nwmc-123\nwmc-456". */
export function parseRejects(body: string): string[] {
  return [...new Set(body.match(/wmc-\d+/g) ?? [])];
}

/** "Approve batch 2026-11" -> "2026-11" */
export function parseApprovalTitle(title: string): string | null {
  return title.match(/^Approve batch (\d{4}-\d{2})\b/)?.[1] ?? null;
}
