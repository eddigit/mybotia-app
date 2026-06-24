import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync(new URL("../src/app/monday/page.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../src/components/layout/LeftSidebar.tsx", import.meta.url), "utf8");

test("Monday page is a separate pilot and keeps existing task cockpit intact", () => {
  assert.match(page, /Monday/);
  assert.match(page, /pilote/i);
  assert.match(page, /read-only|lecture seule/i);
  assert.match(page, /\/api\/monday\/health/);
  assert.match(page, /\/api\/monday\/tasks/);
  assert.doesNotMatch(page, /\/api\/tasks[^/]/);
});

test("Monday page groups useful daily task signals", () => {
  assert.match(page, /Aujourd'hui|Aujourd’hui/);
  assert.match(page, /En retard/);
  assert.match(page, /Projet/);
  assert.match(page, /Statut/);
  assert.match(page, /Responsable/);
});

test("Sidebar exposes Monday test without replacing Tasks", () => {
  assert.match(sidebar, /id: "tasks"/);
  assert.match(sidebar, /href: "\/tasks"/);
  assert.match(sidebar, /id: "monday"/);
  assert.match(sidebar, /Monday test/);
  assert.match(sidebar, /href: "\/monday"/);
});
