import sharp from "sharp";
import { OUT_HEIGHT, OUT_WIDTH, WEBP_QUALITY } from "./config.ts";
import { downloadBuffer, downloadUrlFor } from "./commons.ts";
import { crop169 } from "./filters.ts";
import { sha256Hex } from "./io.ts";
import type { Candidate } from "./schema.ts";

sharp.cache(false);

export interface RenderedPhoto {
  webp: Buffer;
  sha256: string;
}

/** Width to download so the 16:9 crop is still at least 4K wide. */
export function requiredSourceWidth(width: number, height: number): number {
  const cropWidth = crop169(width, height).width;
  return Math.ceil(OUT_WIDTH * (width / cropWidth));
}

/** Downloads a candidate and turns it into a 3840×2160 WebP, cropped around its most interesting region. */
export async function renderPhoto(candidate: Candidate): Promise<RenderedPhoto> {
  const sourceUrl = downloadUrlFor(candidate, requiredSourceWidth(candidate.width, candidate.height));
  const source = await downloadBuffer(sourceUrl);
  const webp = await sharp(source, { limitInputPixels: false })
    .rotate()
    .resize(OUT_WIDTH, OUT_HEIGHT, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: WEBP_QUALITY, effort: 5 })
    .toBuffer();
  return { webp, sha256: sha256Hex(webp) };
}
