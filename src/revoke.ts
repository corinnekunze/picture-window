// Pull published photos: TVs delete them on their next daily check.
//   npx tsx src/revoke.ts wmc-123 wmc-456 [--reason "text on sign"]
import { parseArgs } from "node:util";
import { parseRejects, liveItems, readIndex, rollIndex } from "./manifest.ts";
import { renderCredits } from "./pages.ts";
import { PATHS, appendSeen, readRevoked, writeJson, writeText } from "./state.ts";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { reason: { type: "string", default: "revoked" } } });
const ids = parseRejects(positionals.join(" "));
if (!ids.length) throw new Error("Give one or more photo IDs, like wmc-123456.");

const revoked = [...new Set([...readRevoked(), ...ids])].sort();
writeJson(PATHS.revoked, revoked);
appendSeen(ids.map((id) => ({ id, decision: "revoked" as const, reason: values.reason })));

const previous = readIndex();
if (previous) {
  const { index } = rollIndex(previous, null, revoked, new Date());
  writeJson(PATHS.index, index);
  writeText(`${PATHS.docs}/credits.html`, renderCredits(liveItems(index), index.published));
}
console.log(`Revoked ${ids.join(", ")}`);
