import { z } from "zod";

export const Category = z.enum(["space", "wildlife", "architecture", "cities", "nature"]);

/** Attribution and source facts, kept for every published photo. */
const Credit = z.object({
  title: z.string(),
  author: z.string(),
  license: z.string(),
  licenseUrl: z.string().nullable(),
  sourceUrl: z.string().url(),
});

/** A photo waiting for review. */
export const Candidate = Credit.extend({
  id: z.string().regex(/^wmc-\d+$/),
  category: Category,
  width: z.number().int(),
  height: z.number().int(),
  originalUrl: z.string().url(),
  thumbUrl: z.string().url(),
  nsfw: z.number().min(0).max(1),
  flags: z.array(z.string()),
});
export type Candidate = z.infer<typeof Candidate>;

export const Staging = z.object({
  batch: z.string().regex(/^\d{4}-\d{2}$/),
  staged: z.string().datetime(),
  candidates: z.array(Candidate),
});
export type Staging = z.infer<typeof Staging>;

/** One published photo, as the TV app reads it. */
export const Item = Credit.extend({
  id: z.string(),
  url: z.string().url(),
  width: z.literal(3840),
  height: z.literal(2160),
  bytes: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  category: Category,
});
export type Item = z.infer<typeof Item>;

export const BatchManifest = z.object({
  schema: z.literal(1),
  batch: z.string(),
  published: z.string().datetime(),
  items: z.array(Item),
});
export type BatchManifest = z.infer<typeof BatchManifest>;

/** The small file every TV polls daily. */
export const Index = z.object({
  schema: z.literal(1),
  published: z.string().datetime(),
  batches: z.array(z.object({
    id: z.string(),
    manifest: z.string(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    count: z.number().int(),
    theme: z.string().url().nullable(),
  })),
  revoked: z.array(z.string()),
});
export type Index = z.infer<typeof Index>;

/** Every file ever evaluated, so nothing is rediscovered or reapproved. */
export const SeenEntry = z.object({
  id: z.string(),
  decision: z.enum(["filtered", "nsfw", "staged", "approved", "rejected", "revoked"]),
  reason: z.string().optional(),
  at: z.string(),
});
export type SeenEntry = z.infer<typeof SeenEntry>;
