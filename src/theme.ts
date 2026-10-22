// A monthly CleanYourTV theme: config.json plus a wallpapers/ folder the launcher rotates through,
// and CREDITS.txt, since the launcher can't show a photographer's name on screen.
import { copyFileSync, mkdirSync } from "node:fs";
import { PAGES_URL, THEME_CONFIG, THEME_SIZE } from "./config.ts";
import { writeJson, writeText } from "./io.ts";
import { photoFileName } from "./paths.ts";
import type { Item } from "./schema.ts";

type Credit = Pick<Item, "id" | "title" | "author" | "license" | "sourceUrl">;

/** Plain-text credits for the photos in a theme, one block per photo. */
export function themeCredits(photos: Credit[]): string {
  const header = [
    "Picture Window: photo credits",
    "",
    "These photos come from Wikimedia Commons Featured Pictures and were cropped and resized to 3840x2160.",
    "Each keeps its original license. Share-alike (CC BY-SA) photos are shared under that same license.",
    `All current credits: ${PAGES_URL}/credits.html`,
    "",
  ];
  const blocks = photos.map((photo) => [
    `${photoFileName(photo.id)}`,
    `  ${photo.title}`,
    `  Photo by ${photo.author}, ${photo.license}`,
    `  ${photo.sourceUrl}`,
    "",
  ].join("\n"));
  return [...header, ...blocks].join("\n");
}

/** Writes the theme folder and returns the IDs of the photos in it. */
export function writeTheme(photos: Credit[], imageDir: string, themeDir: string): string[] {
  const themePhotos = photos.slice(0, THEME_SIZE);
  mkdirSync(`${themeDir}/wallpapers`, { recursive: true });
  writeJson(`${themeDir}/config.json`, THEME_CONFIG);
  writeText(`${themeDir}/CREDITS.txt`, themeCredits(themePhotos));
  for (const photo of themePhotos) {
    const fileName = photoFileName(photo.id);
    copyFileSync(`${imageDir}/${fileName}`, `${themeDir}/wallpapers/${fileName}`);
  }
  return themePhotos.map((photo) => photo.id);
}
