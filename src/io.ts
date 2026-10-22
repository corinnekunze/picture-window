import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ZodType } from "zod";

/** Reads a JSON file and validates it, so a malformed file fails loudly instead of spreading. */
export function readJson<T>(path: string, schema: ZodType<T>): T {
  return schema.parse(JSON.parse(readFileSync(path, "utf8")));
}

export function writeJson(path: string, value: unknown): void {
  writeText(path, JSON.stringify(value, null, 2) + "\n");
}

export function writeText(path: string, contents: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}
