import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { OUT_HEIGHT, OUT_WIDTH, VIDEO_CRF, VIDEO_PRESET } from "./config.ts";
import { sha256Hex } from "./io.ts";

const run = promisify(execFile);

export interface StillVideo {
  mp4: Buffer;
  sha256: string;
}

/** ffmpeg arguments for one frame of 4K HEVC, tagged BT.709 so TVs show the photo's colours. */
export function encodeArguments(inputPath: string, outputPath: string): string[] {
  return [
    "-v", "error", "-y",
    // A frame rate gives the lone frame a timestamp; the MP4 muxer refuses one without.
    "-framerate", "1", "-i", inputPath,
    "-frames:v", "1", "-r", "1",
    "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
    "-c:v", "libx265", "-preset", VIDEO_PRESET, "-crf", String(VIDEO_CRF),
    "-x265-params", "log-level=error:colorprim=bt709:transfer=bt709:colormatrix=bt709",
    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
    "-tag:v", "hvc1", "-movflags", "+faststart",
    outputPath,
  ];
}

/** Turns a rendered 4K WebP into a one-frame HEVC video and checks the result before returning it. */
export async function encodeStillVideo(webp: Buffer): Promise<StillVideo> {
  const workDir = mkdtempSync(join(tmpdir(), "picture-window-video-"));
  try {
    const framePath = join(workDir, "frame.png");
    const videoPath = join(workDir, "photo.mp4");
    writeFileSync(framePath, await sharp(webp).png().toBuffer());
    await run("ffmpeg", encodeArguments(framePath, videoPath));
    await checkVideo(videoPath);
    const mp4 = readFileSync(videoPath);
    return { mp4, sha256: sha256Hex(mp4) };
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

/** Refuses anything but a single 3840×2160 HEVC frame. */
async function checkVideo(videoPath: string): Promise<void> {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-count_frames", "-select_streams", "v:0",
    "-show_entries", "stream=codec_name,width,height,nb_read_frames", "-of", "csv=p=0", videoPath,
  ]);
  const expected = `hevc,${OUT_WIDTH},${OUT_HEIGHT},1`;
  if (stdout.trim() !== expected) throw new Error(`Unexpected video "${stdout.trim()}", wanted "${expected}"`);
}
