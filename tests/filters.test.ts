import { describe, expect, it } from "vitest";
import { balance, categorize, check, cleanTitle, crop169, stripHtml, type FileInfo } from "../src/filters.ts";

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

describe("check", () => {
  it("accepts a 4K-capable, freely licensed landscape", () => {
    expect(check(file())).toEqual({ ok: true, category: "nature" });
  });

  it("rejects images that cannot fill a 4K frame after cropping", () => {
    expect(check(file({ width: 3800, height: 2500 }))).toMatchObject({ ok: false, reason: "below 4K" });
    // Wide enough, but too short once cropped to 16:9.
    expect(check(file({ width: 4400, height: 2100 }))).toMatchObject({ ok: false, reason: "below 4K" });
  });

  it("rejects portrait and panoramic shapes", () => {
    expect(check(file({ width: 4000, height: 6000 }))).toMatchObject({ ok: false, reason: "aspect" });
    expect(check(file({ width: 20000, height: 4000 }))).toMatchObject({ ok: false, reason: "aspect" });
  });

  it("only allows licenses that permit redistribution", () => {
    for (const license of ["CC0", "Public domain", "CC BY 4.0", "CC BY-SA 3.0", "CC BY-SA 2.5"]) {
      expect(check(file({ license })).ok, license).toBe(true);
    }
    for (const license of ["GFDL", "CC BY-NC 4.0", "CC BY-ND 4.0", ""]) {
      expect(check(file({ license })).ok, license).toBe(false);
    }
  });

  it("rejects files with restrictions such as personality rights", () => {
    expect(check(file({ restrictions: "personality" }))).toMatchObject({ ok: false });
  });

  it("blocks subjects that don't belong on a family TV", () => {
    expect(check(file({ categories: "War memorials in Italy|Mountains" }))).toMatchObject({ ok: false, reason: "subject: war" });
    expect(check(file({ title: "File:Swiss Guard in Vatican.jpg", categories: "Vatican City" }))).toMatchObject({ ok: false });
    expect(check(file({ categories: "Macro photographs of insects" }))).toMatchObject({ ok: false });
  });

  it("rejects files with no TV-friendly category", () => {
    expect(check(file({ title: "File:Box.jpg", categories: "Boxes" }))).toEqual({ ok: false, reason: "no TV category" });
  });
});

describe("categorize", () => {
  it("prefers the most specific category", () => {
    expect(categorize("Milky Way over a mountain lake")).toBe("space");
    expect(categorize("Heron at a river")).toBe("wildlife");
    expect(categorize("Cathedral in the old town")).toBe("architecture");
  });
});

describe("balance", () => {
  it("caps one category's share and fills the rest in order", () => {
    const items = [
      ...Array.from({ length: 8 }, (_, i) => ({ id: `b${i}`, category: "wildlife" })),
      { id: "n1", category: "nature" },
      { id: "n2", category: "nature" },
    ];
    const picked = balance(items, 5, 0.4);
    expect(picked.map((p) => p.id)).toEqual(["b0", "b1", "n1", "n2", "b2"]);
  });
});

describe("text cleanup", () => {
  it("turns file titles and author HTML into plain text", () => {
    expect(cleanTitle("File:Tower_Bridge golden hour.jpg")).toBe("Tower Bridge golden hour");
    expect(stripHtml('<a href="//commons.wikimedia.org/wiki/User:X">Jane &amp; Co</a>')).toBe("Jane & Co");
  });
});
