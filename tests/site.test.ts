import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderThumbnail } from "../src/photo.ts";
import { monthName, reportUrl } from "../src/site.ts";
import type { Item } from "../src/schema.ts";

const photo = {
  id: "wmc-1",
  title: "Lake & mountains",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Lake.jpg",
} as Item;

describe("photos page", () => {
  it("names a batch by its month", () => {
    expect(monthName("2026-10")).toBe("October 2026");
    expect(monthName("2027-01")).toBe("January 2027");
  });

  it("opens a report issue with the photo's ID and Commons page filled in", () => {
    const url = new URL(reportUrl(photo));
    expect(url.pathname).toMatch(/\/issues\/new$/);
    expect(url.searchParams.get("title")).toBe("Photo to check: wmc-1");
    expect(url.searchParams.get("body")).toContain('wmc-1, "Lake & mountains"');
    expect(url.searchParams.get("body")).toContain(photo.sourceUrl);
  });

  it("makes a 640×360 thumbnail of a 4K photo", async () => {
    const fourK = await sharp({ create: { width: 3840, height: 2160, channels: 3, background: "#336699" } }).webp().toBuffer();
    const metadata = await sharp(await renderThumbnail(fourK)).metadata();
    expect([metadata.format, metadata.width, metadata.height]).toEqual(["webp", 640, 360]);
  });
});
