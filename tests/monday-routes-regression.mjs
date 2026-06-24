import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const health = readFileSync(new URL("../src/app/api/monday/health/route.ts", import.meta.url), "utf8");
const tasks = readFileSync(new URL("../src/app/api/monday/tasks/route.ts", import.meta.url), "utf8");

test("Monday health route is read-only and no-store", () => {
  assert.match(health, /export async function GET/);
  assert.doesNotMatch(health, /export async function POST/);
  assert.match(health, /mondayIsConfigured/);
  assert.match(health, /mondayGraphql/);
  assert.match(health, /no-store/);
});

test("Monday tasks route requires explicit boardId and normalizes items", () => {
  assert.match(tasks, /export async function GET/);
  assert.doesNotMatch(tasks, /export async function POST/);
  assert.match(tasks, /boardId/);
  assert.match(tasks, /normalizeMondayItems/);
  assert.match(tasks, /items_page/);
  assert.match(tasks, /no-store/);
});

test("Monday routes do not expose token values", () => {
  const combined = `${health}\n${tasks}`;
  assert.match(combined, /MONDAY_MYBOTIA_API_TOKEN/);
  assert.doesNotMatch(combined, /NEXT_PUBLIC_MONDAY/);
  assert.doesNotMatch(combined, /process\.env\.MONDAY_MYBOTIA_API_TOKEN[^?]/);
});
