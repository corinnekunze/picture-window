import { describe, expect, it } from "vitest";
import { balanceByCategory, categorize, checkFile, cleanTitle, crop169, pickableCount, stripHtml, type FileInfo } from "../src/filters.ts";

const file = (overrides: Partial<FileInfo> = {}): FileInfo => ({
  title: "File:Lake Bled at sunrise.jpg",
  mime: "image/jpeg",
  width: 6000,
  height: 4000,
  license: "CC BY-SA 4.0",
  restrictions: "",
  categories: "Lake Bled|Landscapes of Slovenia",
  ...overrides,
});

describe("crop169", () => {
  it("trims width from wide images and height from tall ones", () => {
    expect(crop169(8000, 3000)).toEqual({ width: 5333, height: 3000 });
    expect(crop169(6000, 4000)).toEqual({ width: 6000, height: 3375 });
  });
});

describe("checkFile", () => {
  it("accepts a 4K-capable, freely licensed landscape", () => {
    expect(checkFile(file())).toEqual({ ok: true, category: "nature" });
  });

  it("rejects images that cannot fill a 4K frame after cropping", () => {
    expect(checkFile(file({ width: 3800, height: 2500 }))).toMatchObject({ ok: false, reason: "below 4K" });
    // Wide enough, but too short once cropped to 16:9.
    expect(checkFile(file({ width: 4400, height: 2100 }))).toMatchObject({ ok: false, reason: "below 4K" });
  });

  it("rejects portrait and panoramic shapes", () => {
    expect(checkFile(file({ width: 4000, height: 6000 }))).toMatchObject({ ok: false, reason: "aspect" });
    expect(checkFile(file({ width: 20000, height: 4000 }))).toMatchObject({ ok: false, reason: "aspect" });
  });

  it("only allows licenses that permit redistribution", () => {
    for (const license of ["CC0", "Public domain", "CC BY 4.0", "CC BY-SA 3.0", "CC BY-SA 2.5"]) {
      expect(checkFile(file({ license })).ok, license).toBe(true);
    }
    for (const license of ["GFDL", "CC BY-NC 4.0", "CC BY-ND 4.0", ""]) {
      expect(checkFile(file({ license })).ok, license).toBe(false);
    }
  });

  it("rejects files with restrictions such as personality rights", () => {
    expect(checkFile(file({ restrictions: "personality" }))).toMatchObject({ ok: false });
  });

  it("blocks subjects that don't belong on a family TV", () => {
    expect(checkFile(file({ categories: "War memorials in Italy|Mountains" }))).toMatchObject({ ok: false, reason: "subject: war" });
    expect(checkFile(file({ title: "File:Swiss Guard in Vatican.jpg", categories: "Vatican City" }))).toMatchObject({ ok: false });
    expect(checkFile(file({ categories: "Macro photographs of insects" }))).toMatchObject({ ok: false });
  });

  it("rejects files with no TV-friendly category", () => {
    expect(checkFile(file({ title: "File:Box.jpg", categories: "Boxes" }))).toEqual({ ok: false, reason: "no TV category" });
  });
});

describe("categorize", () => {
  it("prefers the most specific category", () => {
    expect(categorize("Milky Way over a mountain lake")).toBe("space");
    expect(categorize("Heron at a river")).toBe("wildlife");
    expect(categorize("Cathedral in the old town")).toBe("architecture");
  });
});

describe("balanceByCategory", () => {
  it("caps one category's share and fills the rest in order", () => {
    const items = [
      ...[...Array(8).keys()].map((position) => ({ id: `b${position}`, category: "wildlife" })),
      { id: "n1", category: "nature" },
      { id: "n2", category: "nature" },
    ];
    const picked = balanceByCategory(items, 5, 0.4);
    expect(picked.map((item) => item.id)).toEqual(["b0", "b1", "n1", "n2", "b2"]);
    expect(pickableCount(items, 5, 0.4)).toBe(4);
  });
});

describe("text cleanup", () => {
  it("turns file titles and author HTML into plain text", () => {
    expect(cleanTitle("File:Tower_Bridge golden hour.jpg")).toBe("Tower Bridge golden hour");
    expect(stripHtml('<a href="//commons.wikimedia.org/wiki/User:X">Jane &amp; Co</a>')).toBe("Jane & Co");
  });
});
