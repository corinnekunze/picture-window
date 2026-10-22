// A monthly CleanYourTV theme: config.json plus a wallpapers/ folder the launcher rotates through.
import { copyFileSync, mkdirSync } from "node:fs";
import { THEME_CONFIG, THEME_SIZE } from "./config.ts";
import { writeJson } from "./io.ts";
import { photoFileName } from "./paths.ts";

/** Writes the theme folder and returns the IDs of the photos in it. */
export function writeTheme(photoIds: string[], imageDir: string, themeDir: string): string[] {
  const themePhotoIds = photoIds.slice(0, THEME_SIZE);
  mkdirSync(`${themeDir}/wallpapers`, { recursive: true });
  writeJson(`${themeDir}/config.json`, THEME_CONFIG);
  for (const photoId of themePhotoIds) {
    const fileName = photoFileName(photoId);
    copyFileSync(`${imageDir}/${fileName}`, `${themeDir}/wallpapers/${fileName}`);
  }
  return themePhotoIds;
}
