#!/usr/bin/env node

import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  alias: {
    "@": new URL("../src", import.meta.url).pathname,
  },
});

const {
  collectMondayImportPlan,
  mondayColumnValuesForCandidate,
} = await jiti.import("../src/lib/monday-import.ts");
const {
  createMondayColumn,
  createMondayGroup,
  createMondayItem,
  createMondayPilotBoard,
  mondayIsConfigured,
} = await jiti.import("../src/lib/monday.ts");

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");

function argValue(name, fallback) {
  const prefix = `${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : fallback;
}

const limit = Math.max(1, Math.min(Number(argValue("--limit", "250")), 500));
const boardName = argValue("--board-name", "MyBotIA - Production & Taches");

const columnsSpec = [
  { key: "kind", title: "Type", type: "status" },
  { key: "client", title: "Client", type: "text" },
  { key: "project", title: "Projet", type: "text" },
  { key: "status", title: "Statut", type: "status" },
  { key: "owner", title: "Responsable", type: "text" },
  { key: "priority", title: "Priorite", type: "status" },
  { key: "value", title: "Valeur / tarif", type: "text" },
  { key: "dueDate", title: "Date", type: "date" },
  { key: "source", title: "Source", type: "text" },
  { key: "sourceUrl", title: "Lien source", type: "text" },
  { key: "sourcePath", title: "Memoire", type: "text" },
  { key: "notes", title: "Notes", type: "long_text" },
];

async function createBoardShape() {
  const board = await createMondayPilotBoard(boardName);
  if (!board.ok) return board;

  const taskGroup = await createMondayGroup(board.data.id, "Production / taches");
  if (!taskGroup.ok) return taskGroup;

  const productGroup = await createMondayGroup(board.data.id, "Produits / offres");
  if (!productGroup.ok) return productGroup;

  const columns = {};
  for (const column of columnsSpec) {
    const created = await createMondayColumn(board.data.id, column.title, column.type);
    if (!created.ok) return created;
    columns[column.key] = created.data.id;
  }

  return {
    ok: true,
    data: {
      board: board.data,
      groups: { task: taskGroup.data, product: productGroup.data },
      columns,
    },
  };
}

function printPlan(plan) {
  console.log(JSON.stringify({
    dryRun: !apply,
    mondayConfigured: mondayIsConfigured(),
    total: plan.counts.total,
    bySource: plan.counts.bySource,
    byClient: plan.counts.byClient,
    warnings: plan.warnings,
    sample: plan.candidates.slice(0, 12).map((candidate) => ({
      kind: candidate.kind,
      client: candidate.client,
      project: candidate.project,
      title: candidate.title,
      value: candidate.value,
      source: candidate.source,
    })),
  }, null, 2));
}

const plan = await collectMondayImportPlan(!apply);
printPlan(plan);

if (!apply) {
  process.exit(0);
}

if (!mondayIsConfigured()) {
  console.error("MONDAY_MYBOTIA_API_TOKEN absent de l'environnement. Import annule.");
  process.exit(2);
}

const shaped = await createBoardShape();
if (!shaped.ok) {
  console.error(`Creation board Monday impossible: ${shaped.error.message}`);
  process.exit(3);
}

const candidates = plan.candidates.slice(0, limit);
const imported = [];
for (const candidate of candidates) {
  const groupId = candidate.kind === "product" ? shaped.data.groups.product.id : shaped.data.groups.task.id;
  const created = await createMondayItem(
    shaped.data.board.id,
    groupId,
    candidate.title,
    mondayColumnValuesForCandidate(candidate, shaped.data.columns),
  );
  if (!created.ok) {
    console.error(`Import arrete apres ${imported.length} lignes: ${created.error.message}`);
    process.exit(4);
  }
  imported.push({ key: candidate.key, itemId: created.data.id, title: created.data.name });
}

console.log(JSON.stringify({
  imported: imported.length,
  skipped: Math.max(0, plan.candidates.length - imported.length),
  board: shaped.data.board,
  groups: shaped.data.groups,
}, null, 2));
