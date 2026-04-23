#!/usr/bin/env node
// Auto-injection du commit hash + horodatage de build (heure Paris)
// Lance via prebuild / predev hook (cf. package.json)

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

let commit = "dev";
try {
  commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
} catch {
  // pas de git, fallback "dev"
}

const formatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const parts = formatter.formatToParts(new Date());
const get = (type) => parts.find((p) => p.type === type)?.value || "";
const buildTime = `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;

const content = `// Auto-genere par scripts/generate-build-info.js — NE PAS EDITER MANUELLEMENT
export const BUILD_COMMIT = "${commit}";
export const BUILD_TIME = "${buildTime}";
`;

const outDir = path.join(__dirname, "..", "src", "lib");
const out = path.join(outDir, "build-info.ts");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(out, content);
console.log(`[build-info] commit=${commit} time=${buildTime} -> ${out}`);
