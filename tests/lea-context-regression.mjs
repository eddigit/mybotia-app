import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const bridge = readFileSync(new URL("../src/lib/claude-bridge.ts", import.meta.url), "utf8");
const streamRoute = readFileSync(new URL("../src/app/api/conversations/stream/route.ts", import.meta.url), "utf8");
const internalRoute = readFileSync(new URL("../src/app/api/internal/lea-context/route.ts", import.meta.url), "utf8");

test("Lea context is a single bridge context for all channels", () => {
  assert.match(bridge, /export function buildIntegrationContext/);
  assert.match(bridge, /agent_name:\s*"Léa"/);
  assert.match(bridge, /Postgres/);
  assert.match(bridge, /mybotia_memory/);
  assert.match(bridge, /RAG Obsidian/);
  assert.match(bridge, /dossiers clients/);
  assert.match(bridge, /documents\/GED/);
  assert.match(bridge, /CRM/);
  assert.match(bridge, /Trello/);
  assert.match(bridge, /Monday/);
  assert.match(bridge, /Sajjad/);
  assert.match(bridge, /même périmètre de lecture métier/);
  assert.doesNotMatch(bridge, /ELEA/);
});

test("streaming webchat sends the same Lea integration context", () => {
  assert.match(streamRoute, /buildIntegrationContext/);
  assert.match(streamRoute, /integration_context:\s*buildIntegrationContext\(\)/);
});

test("internal Lea context endpoint is protected and does not expose secrets", () => {
  assert.match(internalRoute, /MYBOTIA_INTERNAL_TOKEN/);
  assert.match(internalRoute, /buildIntegrationContext/);
  assert.doesNotMatch(internalRoute, /process\.env\.MONDAY_MYBOTIA_API_TOKEN/);
  assert.doesNotMatch(internalRoute, /NEXT_PUBLIC/);
});
