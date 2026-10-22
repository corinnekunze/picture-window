import { REPO } from "./config.ts";

/** Where every file the pipeline reads or writes lives, relative to the repo root. */
export const PATHS = {
  ledger: "state/seen.jsonl",
  revoked: "state/revoked.json",
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

export function releaseAssetUrl(batch: string, fileName: string): string {
  return `https://github.com/${REPO}/releases/download/${releaseTag(batch)}/${fileName}`;
}

export function photoFileName(photoId: string): string {
  return `${photoId}.webp`;
}
