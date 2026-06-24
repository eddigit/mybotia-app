import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const routeFile = path.join(root, "src/app/api/conversations/stream/route.ts");
const source = fs.readFileSync(routeFile, "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  !source.includes("const BRIDGE_TOKEN = requireBridgeToken();"),
  "The conversation stream route must not require CLAUDE_BRIDGE_TOKEN at module load, because Next build imports routes while collecting page data."
);

assert(
  source.includes("const bridgeToken = requireBridgeToken();") &&
    source.includes("Authorization: `Bearer ${bridgeToken}`"),
  "The conversation stream route must resolve the bridge token lazily inside POST."
);

console.log("bridge token build regression OK");
