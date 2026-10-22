import { CATEGORIES, LICENSE_ALLOW, MAX_ASPECT, MIN_ASPECT, OUT_HEIGHT, OUT_WIDTH, SUBJECT_BLOCK, type Category } from "./config.ts";

/** The metadata the filters need; fetched without downloading any image. */
export interface FileInfo {
  title: string;
  mime: string;
  width: number;
  height: number;
  license: string;
  restrictions: string;
  categories: string;
}

export type Verdict = { ok: true; category: Category } | { ok: false; reason: string };

/** Size of the largest 16:9 crop of a width × height image. */
export function crop169(width: number, height: number): { width: number; height: number } {
  return width / height >= 16 / 9
    ? { width: Math.floor((height * 16) / 9), height }
    : { width, height: Math.floor((width * 9) / 16) };
}

export function categorize(text: string): Category | null {
  for (const [name, pattern] of CATEGORIES) if (pattern.test(text)) return name;
  return null;
}

/** Cheap, metadata-only checks, ordered from most to least common rejection. */
export function check(file: FileInfo): Verdict {
  const aspect = file.width / file.height;
  if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) return { ok: false, reason: "aspect" };
  const crop = crop169(file.width, file.height);
  if (crop.width < OUT_WIDTH || crop.height < OUT_HEIGHT) return { ok: false, reason: "below 4K" };
  if (file.mime !== "image/jpeg") return { ok: false, reason: "not a photo" };
  if (!LICENSE_ALLOW.test(file.license.trim())) return { ok: false, reason: `license: ${file.license || "none"}` };
  if (file.restrictions.trim()) return { ok: false, reason: `restrictions: ${file.restrictions.trim()}` };
  const text = `${file.title}|${file.categories}`;
  const blocked = text.match(SUBJECT_BLOCK);
  if (blocked) return { ok: false, reason: `subject: ${blocked[0].toLowerCase()}` };
  const category = categorize(text);
  if (!category) return { ok: false, reason: "no TV category" };
  return { ok: true, category };
}

/** "File:Tower Bridge golden hour.jpg" -> "Tower Bridge golden hour" */
export function cleanTitle(fileTitle: string): string {
  return fileTitle.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ").trim();
}

/** Commons author fields are HTML; keep the visible text only. */
export function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, " ").trim();
}

/**
 * Picks up to `count` candidates in order, keeping any one category to at most
 * `maxShare` of the result unless there is nothing else to take.
 */
export function balance<T extends { category: string }>(items: T[], count: number, maxShare: number): T[] {
  const cap = Math.max(1, Math.floor(count * maxShare));
  const taken = new Map<string, number>();
  const picked: T[] = [];
  const overflow: T[] = [];
  for (const item of items) {
    if (picked.length === count) break;
    const n = taken.get(item.category) ?? 0;
    if (n < cap) {
      picked.push(item);
      taken.set(item.category, n + 1);
    } else overflow.push(item);
  }
  for (const item of overflow) {
    if (picked.length === count) break;
    picked.push(item);
  }
  return picked;
}
