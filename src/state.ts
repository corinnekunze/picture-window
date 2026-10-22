import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ZodType } from "zod";
import { SeenEntry } from "./schema.ts";

export const PATHS = {
  seen: "state/seen.jsonl",
  revoked: "state/revoked.json",
  staging: "staging/current.json",
  docs: "docs",
  index: "docs/index.json",
  batches: "docs/batches",
  out: "out",
};

export function readJson<T>(path: string, schema: ZodType<T>): T {
  return schema.parse(JSON.parse(readFileSync(path, "utf8")));
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

export function writeText(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

/** The latest decision per file ID. */
export function readSeen(): Map<string, SeenEntry> {
  const seen = new Map<string, SeenEntry>();
  if (!existsSync(PATHS.seen)) return seen;
  for (const line of readFileSync(PATHS.seen, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const entry = SeenEntry.parse(JSON.parse(line));
    seen.set(entry.id, entry);
  }
  return seen;
}

export function appendSeen(entries: Omit<SeenEntry, "at">[]): void {
  if (!entries.length) return;
  mkdirSync(dirname(PATHS.seen), { recursive: true });
  const at = new Date().toISOString();
  appendFileSync(PATHS.seen, entries.map((e) => JSON.stringify({ ...e, at })).join("\n") + "\n");
}

export function readRevoked(): string[] {
  return existsSync(PATHS.revoked) ? (JSON.parse(readFileSync(PATHS.revoked, "utf8")) as string[]) : [];
}

/** "2026-11" for a date. */
export function batchId(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}
