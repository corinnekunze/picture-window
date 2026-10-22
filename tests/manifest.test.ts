import { describe, expect, it } from "vitest";
import { parseApprovedBatch, parsePhotoIds } from "../src/approval.ts";
import { rollIndex, type IndexEntry } from "../src/manifest.ts";

const entry = (id: string): IndexEntry => ({ id, manifest: `batches/${id}.json`, sha256: "a".repeat(64), count: 350, theme: null });
const now = new Date("2026-11-02T00:00:00Z");

describe("rollIndex", () => {
  it("keeps the newest batches and reports the ones that fell out", () => {
    let index = null;
    let dropped: string[] = [];
    for (const id of ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]) {
      ({ index, dropped } = rollIndex(index, entry(id), [], now));
    }
    expect(index!.batches.map((batch) => batch.id)).toEqual(["2026-11", "2026-10", "2026-09", "2026-08", "2026-07", "2026-06"]);
    expect(dropped).toEqual(["2026-05"]);
  });

  it("replaces a batch republished under the same ID", () => {
    const first = rollIndex(null, entry("2026-11"), [], now).index;
    const again = rollIndex(first, { ...entry("2026-11"), count: 300 }, [], now).index;
    expect(again.batches).toHaveLength(1);
    expect(again.batches[0]!.count).toBe(300);
  });

  it("carries revocations without touching batches", () => {
    const first = rollIndex(null, entry("2026-11"), [], now).index;
    const revoked = rollIndex(first, null, ["wmc-2", "wmc-1", "wmc-2"], now).index;
    expect(revoked.revoked).toEqual(["wmc-1", "wmc-2"]);
    expect(revoked.batches).toEqual(first.batches);
  });
});

describe("approval issues", () => {
  it("reads the batch from the title and IDs from the body", () => {
    expect(parseApprovedBatch("Approve batch 2026-11")).toBe("2026-11");
    expect(parseApprovedBatch("Please approve 2026-11")).toBeNull();
    expect(parsePhotoIds("reject:\nwmc-12\nwmc-34\nwmc-12\n\nApproved from the review page.")).toEqual(["wmc-12", "wmc-34"]);
    expect(parsePhotoIds("No rejects.")).toEqual([]);
  });
});
