import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { Item } from "../src/schema.ts";
import { encodeArguments, encodeStillVideo } from "../src/video.ts";

const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const item = {
  id: "wmc-1",
  title: "T",
  author: "A",
  license: "CC0",
  licenseUrl: null,
  sourceUrl: "https://commons.wikimedia.org/wiki/File:T.jpg",
  url: "https://github.com/o/r/releases/download/batch-2026-10/wmc-1.webp",
  width: 3840,
  height: 2160,
  bytes: 10,
  sha256: "a".repeat(64),
  category: "space",
};

describe("feed items", () => {
  it("accepts items with and without a video", () => {
    expect(Item.parse(item).video).toBeUndefined();
    const video = { url: "https://github.com/o/r/releases/download/batch-2026-10/wmc-1.mp4", bytes: 5, sha256: "b".repeat(64) };
    expect(Item.parse({ ...item, video }).video).toEqual(video);
  });

  it("rejects a video without a valid hash", () => {
    expect(() => Item.parse({ ...item, video: { url: "https://x.test/v.mp4", bytes: 5, sha256: "nope" } })).toThrow();
  });
});

describe("still videos", () => {
  it("encodes one HEVC frame tagged BT.709 for TVs", () => {
    const args = encodeArguments("in.png", "out.mp4");
    expect(args).toEqual(expect.arrayContaining(["libx265", "hvc1", "bt709", "-frames:v", "1"]));
  });

  it.skipIf(!hasFfmpeg)("turns a 4K WebP into a single 4K HEVC frame", async () => {
    const webp = await sharp({ create: { width: 3840, height: 2160, channels: 3, background: { r: 40, g: 90, b: 160 } } }).webp().toBuffer();
    const { mp4, sha256 } = await encodeStillVideo(webp);
    expect(mp4.length).toBeGreaterThan(0);
    expect(sha256).toMatch(/^[0-9a-f]{64}$/);
  }, 120_000);
});
