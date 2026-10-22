// The GitHub Pages site. Markup lives in templates/*.eta; styles and the review
// page's script are static files in docs/assets/.
import { resolve } from "node:path";
import { Eta } from "eta";
import { REPO } from "./config.ts";
import { thumbnailAtWidth } from "./commons.ts";
import { writeText } from "./io.ts";
import { sitePath, PATHS } from "./paths.ts";
import type { Item, Staging } from "./schema.ts";

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

export function writeCreditsPage(photos: Item[], published: string): void {
  const html = eta.render("./credits", { root: "", photos, updated: published.slice(0, 10) });
  writeText(sitePath("credits.html"), html);
}

export function writeLandingPage(): void {
  writeText(sitePath("index.html"), eta.render("./landing", { root: "", repo: REPO }));
}
