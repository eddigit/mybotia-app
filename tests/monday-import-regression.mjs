import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const monday = readFileSync(new URL("../src/lib/monday.ts", import.meta.url), "utf8");
const importer = readFileSync(new URL("../src/lib/monday-import.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/app/api/monday/import/route.ts", import.meta.url), "utf8");
const bridge = readFileSync(new URL("../src/lib/claude-bridge.ts", import.meta.url), "utf8");

test("Monday mutations create only boards, groups, columns, items, and updates", () => {
  assert.match(monday, /export async function createMondayPilotBoard/);
  assert.match(monday, /export async function createMondayColumn/);
  assert.match(monday, /export async function createMondayItem/);
  assert.match(monday, /export async function updateMondayItemColumns/);
  assert.doesNotMatch(monday, /delete_/i);
  assert.doesNotMatch(monday, /archive_/i);
});

test("Monday importer targets MyBotIA client memories and keeps source traces", () => {
  for (const name of ["systemic", "kibia", "mp-conseil", "levinet", "artroyal", "igh"]) {
    assert.match(importer, new RegExp(name, "i"));
  }
  assert.match(importer, /collectMondayImportPlan/);
  assert.match(importer, /memory:product/);
  assert.match(importer, /kind: "product"/);
  assert.match(importer, /sourcePath/);
  assert.match(importer, /memory:lea/);
  assert.match(importer, /mybotia-business/);
  assert.match(importer, /trello/);
});

test("Monday import route is dry-run by default and requires explicit apply confirmation", () => {
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(route, /confirmApply/);
  assert.match(route, /superadmin_required/);
  assert.match(route, /dryRun/);
  assert.match(route, /createMondayPilotBoard/);
  assert.doesNotMatch(route, /DELETE/);
});

test("Lea bridge prompt exposes Monday as connected source without removing existing sources", () => {
  assert.match(bridge, /Monday/);
  assert.match(bridge, /MONDAY_MYBOTIA_API_TOKEN/);
  assert.match(bridge, /Trello/);
  assert.match(bridge, /CRM/);
});
