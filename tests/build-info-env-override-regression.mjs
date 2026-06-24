import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const buildInfoPath = join(root, "src/lib/build-info.ts");
const hadBuildInfo = existsSync(buildInfoPath);
const previousBuildInfo = hadBuildInfo ? readFileSync(buildInfoPath, "utf8") : null;

try {
  execFileSync("node", ["scripts/generate-build-info.js"], {
    cwd: root,
    env: {
      ...process.env,
      BUILD_COMMIT: "deploy-override-123",
    },
    stdio: "pipe",
  });

  const generated = readFileSync(buildInfoPath, "utf8");
  assert.match(generated, /BUILD_COMMIT = "deploy-override-123"/);
} finally {
  if (hadBuildInfo && previousBuildInfo !== null) {
    writeFileSync(buildInfoPath, previousBuildInfo);
  } else {
    rmSync(buildInfoPath, { force: true });
  }
}
