// Pull published photos: TVs delete them on their next daily check.
//   npm run revoke -- wmc-123 wmc-456 [--reason "text on sign"]
import { parseArgs } from "node:util";
import { parsePhotoIds } from "../approval.ts";
import { writeJson } from "../io.ts";
import { readRevokedIds, recordDecisions, writeRevokedIds } from "../ledger.ts";
import { readIndex, rollIndex } from "../manifest.ts";
import { PATHS } from "../paths.ts";
import { writePublicPages } from "../site.ts";

function readRequest(): { photoIds: string[]; reason: string } {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { reason: { type: "string", default: "revoked" } } });
  const photoIds = parsePhotoIds(positionals.join(" "));
  if (!photoIds.length) throw new Error("Give one or more photo IDs, like wmc-123456.");
  return { photoIds, reason: values.reason };
}

function republishIndex(revokedIds: string[]): void {
  const previous = readIndex();
  if (!previous) return;

  const { index } = rollIndex(previous, null, revokedIds, new Date());
  writeJson(PATHS.index, index);
  writePublicPages(index);
}

function main(): void {
  const { photoIds, reason } = readRequest();
  const revokedIds = [...readRevokedIds(), ...photoIds];
  writeRevokedIds(revokedIds);
  recordDecisions(photoIds.map((photoId) => ({ id: photoId, decision: "revoked", reason })));
  republishIndex(revokedIds);
  console.log(`Revoked ${photoIds.join(", ")}`);
}

main();
