// The ledger records every file ever evaluated and what was decided, so nothing is
// rediscovered or reapproved. Append-only: the latest line for an ID wins.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import { readJson, writeJson } from "./io.ts";
import { PATHS } from "./paths.ts";
import { LedgerEntry } from "./schema.ts";

export type Decision = Omit<LedgerEntry, "at">;

export function readLedger(): Map<string, LedgerEntry> {
  const latestById = new Map<string, LedgerEntry>();
  if (!existsSync(PATHS.ledger)) return latestById;

  const lines = readFileSync(PATHS.ledger, "utf8").split("\n").filter((line) => line.trim());
  for (const line of lines) {
    const entry = LedgerEntry.parse(JSON.parse(line));
    latestById.set(entry.id, entry);
  }
  return latestById;
}

export function recordDecisions(decisions: Decision[]): void {
  if (!decisions.length) return;

  const at = new Date().toISOString();
  const lines = decisions.map((decision) => JSON.stringify({ ...decision, at }));
  mkdirSync(dirname(PATHS.ledger), { recursive: true });
  appendFileSync(PATHS.ledger, lines.join("\n") + "\n");
}

export function readRevokedIds(): string[] {
  if (!existsSync(PATHS.revoked)) return [];
  return readJson(PATHS.revoked, z.array(z.string()));
}

export function writeRevokedIds(photoIds: string[]): void {
  writeJson(PATHS.revoked, [...new Set(photoIds)].sort());
}

/** Batch ID for a month, e.g. "2026-11". */
export function batchIdFor(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}
