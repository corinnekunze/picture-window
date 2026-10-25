// The GitHub Pages site. Markup lives in templates/*.eta; styles and the review
// page's script are static files in docs/assets/.
import { resolve } from "node:path";
import { Eta } from "eta";
import { REPO } from "./config.ts";
import { thumbnailAtWidth } from "./commons.ts";
import { writeText } from "./io.ts";
import { liveBatches, type LiveBatch } from "./manifest.ts";
import { sitePath, thumbAssetUrl, PATHS } from "./paths.ts";
import type { Index, Item, Staging } from "./schema.ts";

const ZOOM_WIDTH = 1280;

const eta = new Eta({ views: resolve(PATHS.templates), autoEscape: true });

const CATEGORY_LABELS: Record<string, string> = {
  nature: "Nature", wildlife: "Wildlife", architecture: "Architecture", cities: "Cities", space: "Space",
};

/** Category filter chips with counts, "All" first. */
function categoryChips(categories: string[]): { id: string; label: string; count: number }[] {
  const counts = Map.groupBy(categories, (category) => category);
  const chips = [...counts].map(([id, members]) => ({ id, label: CATEGORY_LABELS[id] ?? id, count: members.length }));
  return [{ id: "all", label: "All", count: categories.length }, ...chips];
}

export function writeReviewPage(staging: Staging): void {
  const photos = staging.candidates.map((candidate) => ({
    ...candidate,
    zoomUrl: thumbnailAtWidth(candidate.thumbUrl, ZOOM_WIDTH),
  }));
  const html = eta.render("./review", {
    root: "../",
    repo: REPO,
    batch: staging.batch,
    photos,
    flaggedCount: photos.filter((photo) => photo.flags.length).length,
    chips: categoryChips(photos.map((photo) => photo.category)),
  });
  writeText(sitePath("review/index.html"), html);
}

export function writeEmptyReviewPage(): void {
  writeText(sitePath("review/index.html"), eta.render("./review-empty", { root: "../" }));
}

/** "2026-10" as "October 2026". */
export function monthName(batch: string): string {
  return new Date(`${batch}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** A new GitHub issue about one photo, with its ID and links filled in. */
export function reportUrl(photo: Item): string {
  const title = `Photo to check: ${photo.id}`;
  const body = [
    `Photo: ${photo.id}, "${photo.title}"`,
    `Commons page: ${photo.sourceUrl}`,
    "",
    "What's wrong with it?",
    "",
  ].join("\n");
  return `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

function photosPageBatch(batch: LiveBatch) {
  return {
    id: batch.id,
    month: monthName(batch.id),
    photos: batch.photos.map((photo) => ({ ...photo, thumbUrl: thumbAssetUrl(batch.id, photo.id), reportUrl: reportUrl(photo) })),
  };
}

function writeCreditsPage(photos: Item[], published: string): void {
  const html = eta.render("./credits", { root: "", photos, updated: published.slice(0, 10) });
  writeText(sitePath("credits.html"), html);
}

function writePhotosPage(batches: LiveBatch[], published: string): void {
  const html = eta.render("./photos", {
    root: "",
    repo: REPO,
    batches: batches.map(photosPageBatch),
    photoCount: batches.reduce((total, batch) => total + batch.photos.length, 0),
    chips: categoryChips(batches.flatMap((batch) => batch.photos.map((photo) => photo.category))),
    updated: published.slice(0, 10),
  });
  writeText(sitePath("photos.html"), html);
}

/** The pages that list what TVs show: the photos page and the credits page. */
export function writePublicPages(index: Index): void {
  const batches = liveBatches(index);
  writeCreditsPage(batches.flatMap((batch) => batch.photos), index.published);
  writePhotosPage(batches, index.published);
}

export function writeLandingPage(): void {
  writeText(sitePath("index.html"), eta.render("./landing", { root: "", repo: REPO }));
}
