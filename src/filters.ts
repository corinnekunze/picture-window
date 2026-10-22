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

interface Size {
  width: number;
  height: number;
}

/** Size of the largest 16:9 crop of an image. */
export function crop169(width: number, height: number): Size {
  const isWiderThan169 = width / height >= 16 / 9;
  if (isWiderThan169) return { width: Math.floor((height * 16) / 9), height };
  return { width, height: Math.floor((width * 9) / 16) };
}

export function categorize(text: string): Category | null {
  const match = CATEGORIES.find(([, pattern]) => pattern.test(text));
  return match ? match[0] : null;
}

/** Cheap, metadata-only checks, ordered from most to least common rejection. */
export function checkFile(file: FileInfo): Verdict {
  const aspect = file.width / file.height;
  if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) return { ok: false, reason: "aspect" };

  const crop = crop169(file.width, file.height);
  if (crop.width < OUT_WIDTH || crop.height < OUT_HEIGHT) return { ok: false, reason: "below 4K" };

  if (file.mime !== "image/jpeg") return { ok: false, reason: "not a photo" };

  if (!LICENSE_ALLOW.test(file.license.trim())) return { ok: false, reason: `license: ${file.license || "none"}` };

  const restrictions = file.restrictions.trim();
  if (restrictions) return { ok: false, reason: `restrictions: ${restrictions}` };

  const searchable = `${file.title}|${file.categories}`;
  const blockedSubject = searchable.match(SUBJECT_BLOCK);
  if (blockedSubject) return { ok: false, reason: `subject: ${blockedSubject[0].toLowerCase()}` };

  const category = categorize(searchable);
  if (!category) return { ok: false, reason: "no TV category" };

  return { ok: true, category };
}

/** "File:Tower_Bridge golden hour.jpg" -> "Tower Bridge golden hour" */
export function cleanTitle(fileTitle: string): string {
  return fileTitle.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ").trim();
}

/** Commons author fields are HTML; keep the visible text only. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Most items of one category a batch of `count` may hold. */
export function categoryCap(count: number, maxShare: number): number {
  return Math.max(1, Math.floor(count * maxShare));
}

/** How many of `items` could be picked right now without breaking the category cap. */
export function pickableCount(items: { category: string }[], count: number, maxShare: number): number {
  const cap = categoryCap(count, maxShare);
  const perCategory = Map.groupBy(items, (item) => item.category);
  return [...perCategory.values()].reduce((total, group) => total + Math.min(group.length, cap), 0);
}

/**
 * Picks up to `count` items in order, keeping each category to at most `maxShare`
 * of the result. If that leaves the batch short, the over-cap items fill it in order.
 */
export function balanceByCategory<T extends { category: string }>(items: T[], count: number, maxShare: number): T[] {
  const cap = categoryCap(count, maxShare);
  const takenPerCategory = new Map<string, number>();
  const picked: T[] = [];
  const overCap: T[] = [];

  for (const item of items) {
    if (picked.length === count) break;
    const taken = takenPerCategory.get(item.category) ?? 0;
    if (taken >= cap) {
      overCap.push(item);
      continue;
    }
    picked.push(item);
    takenPerCategory.set(item.category, taken + 1);
  }

  const shortfall = count - picked.length;
  return [...picked, ...overCap.slice(0, shortfall)];
}
