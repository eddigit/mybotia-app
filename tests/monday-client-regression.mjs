import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../src/lib/monday.ts", import.meta.url), "utf8");

test("Monday client reads only the server-side MyBotIA token name", () => {
  assert.match(source, /MONDAY_MYBOTIA_API_TOKEN/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_MONDAY/);
  assert.doesNotMatch(source, /console\.log\(.*token/i);
});

test("Monday client exposes degraded mode and normalized task helpers", () => {
  assert.match(source, /export function mondayIsConfigured/);
  assert.match(source, /export async function mondayGraphql/);
  assert.match(source, /export function normalizeMondayItems/);
  assert.match(source, /missing_credentials/);
  assert.match(source, /MondayTask/);
});

test("Monday client uses GraphQL Authorization header without query-string credentials", () => {
  assert.match(source, /https:\/\/api\.monday\.com\/v2/);
  assert.match(source, /Authorization/);
  assert.match(source, /API-Version/);
  assert.doesNotMatch(source, /searchParams\.set\(["']token/);
});
