import { REPO } from "./config.ts";

/** Where every file the pipeline reads or writes lives, relative to the repo root. */
export const PATHS = {
  ledger: "state/seen.jsonl",
  revoked: "state/revoked.json",
  /** Place names already looked up on OpenStreetMap, by rounded coordinates. */
  places: "state/places.json",
  staging: "staging/current.json",
  templates: "templates",
  /** The GitHub Pages site. Everything here is generated except `assets/`. */
  site: "docs",
  index: "docs/index.json",
  /** Build output uploaded to a release, never committed. */
  out: "out",
};

export function sitePath(relativePath: string): string {
  return `${PATHS.site}/${relativePath}`;
}

/** Batch manifest path relative to the site root, as listed in index.json. */
export function batchManifestPath(batch: string): string {
  return `batches/${batch}.json`;
}

export function releaseTag(batch: string): string {
  return `batch-${batch}`;
}

export function themeName(batch: string): string {
  return `theme-${batch}`;
}

/**
 * Videos get a release of their own: GitHub allows 1,000 files per release, and a big batch's photos,
 * theme and videos together can pass that (2026-10 had 900 photos).
 */
export function videoReleaseTag(batch: string): string {
  return `videos-${batch}`;
}

/** Thumbnails for the photos page get a third release, for the same 1,000-file reason. */
export function thumbReleaseTag(batch: string): string {
  return `thumbs-${batch}`;
}

export function releaseAssetUrl(batch: string, fileName: string): string {
  return `https://github.com/${REPO}/releases/download/${releaseTag(batch)}/${fileName}`;
}

export function videoAssetUrl(batch: string, fileName: string): string {
  return `https://github.com/${REPO}/releases/download/${videoReleaseTag(batch)}/${fileName}`;
}

export function thumbAssetUrl(batch: string, photoId: string): string {
  return `https://github.com/${REPO}/releases/download/${thumbReleaseTag(batch)}/${photoFileName(photoId)}`;
}

export function photoFileName(photoId: string): string {
  return `${photoId}.webp`;
}

export function videoFileName(photoId: string): string {
  return `${photoId}.mp4`;
}
