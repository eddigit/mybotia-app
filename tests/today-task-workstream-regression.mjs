import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const todayPage = readFileSync(join(root, "src/app/today/page.tsx"), "utf8");
const todayRoute = readFileSync(join(root, "src/app/api/today/route.ts"), "utf8");
const hooks = readFileSync(join(root, "src/hooks/use-api.ts"), "utf8");

assert.match(
  hooks,
  /category\?: string;/,
  "TaskItem must expose the task business category",
);

assert.match(
  hooks,
  /workflowStep\?: string;/,
  "TaskItem must expose the task workflow step",
);

assert.match(
  todayRoute,
  /category:\s*t\.category/,
  "Today business payload must forward task category",
);

assert.match(
  todayRoute,
  /workflowStep:\s*t\.workflowStep/,
  "Today business payload must forward task workflow step",
);

assert.match(
  todayPage,
  /taskWorkstream/,
  "Today page must classify tasks by workstream",
);

assert.match(
  todayPage,
  /Commerce/,
  "Today task rows must be able to show Commerce category",
);

assert.match(
  todayPage,
  /Production/,
  "Today task rows must be able to show Production category",
);

console.log("today task workstream regression OK");
