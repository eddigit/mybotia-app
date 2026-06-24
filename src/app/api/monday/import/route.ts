import {
  createMondayColumn,
  createMondayGroup,
  createMondayItem,
  createMondayPilotBoard,
  mondayIsConfigured,
} from "@/lib/monday";
import {
  collectMondayImportPlan,
  mondayColumnValuesForCandidate,
  type MondayImportCandidate,
} from "@/lib/monday-import";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

const MONDAY_COLUMNS = [
  { key: "kind", title: "Type", type: "status" as const },
  { key: "client", title: "Client", type: "text" as const },
  { key: "project", title: "Projet", type: "text" as const },
  { key: "status", title: "Statut", type: "status" as const },
  { key: "owner", title: "Responsable", type: "text" as const },
  { key: "priority", title: "Priorite", type: "status" as const },
  { key: "value", title: "Valeur / tarif", type: "text" as const },
  { key: "dueDate", title: "Date", type: "date" as const },
  { key: "source", title: "Source", type: "text" as const },
  { key: "sourceUrl", title: "Lien source", type: "text" as const },
  { key: "sourcePath", title: "Memoire", type: "text" as const },
  { key: "notes", title: "Notes", type: "long_text" as const },
];

type ApplyBody = {
  confirmApply?: boolean;
  boardName?: string;
  limit?: number;
};

export async function GET() {
  const plan = await collectMondayImportPlan(true);
  return Response.json({ dryRun: true, mondayConfigured: mondayIsConfigured(), plan }, { headers: NO_STORE });
}

async function createBoardShape(boardName: string) {
  const board = await createMondayPilotBoard(boardName);
  if (!board.ok) return board;

  const taskGroup = await createMondayGroup(board.data.id, "Production / taches");
  if (!taskGroup.ok) return taskGroup;

  const productGroup = await createMondayGroup(board.data.id, "Produits / offres");
  if (!productGroup.ok) return productGroup;

  const columns: Record<string, string> = {};
  for (const column of MONDAY_COLUMNS) {
    const created = await createMondayColumn(board.data.id, column.title, column.type);
    if (!created.ok) return created;
    columns[column.key] = created.data.id;
  }

  return { ok: true as const, data: { board: board.data, groups: { task: taskGroup.data, product: productGroup.data }, columns } };
}

async function importCandidates(
  boardId: string,
  groups: { task: { id: string }; product: { id: string } },
  columns: Record<string, string>,
  candidates: MondayImportCandidate[],
) {
  const imported: { key: string; itemId: string; title: string }[] = [];
  for (const candidate of candidates) {
    const groupId = candidate.kind === "product" ? groups.product.id : groups.task.id;
    const created = await createMondayItem(
      boardId,
      groupId,
      candidate.title,
      mondayColumnValuesForCandidate(candidate, columns),
    );
    if (!created.ok) {
      return { ok: false as const, error: created.error, imported };
    }
    imported.push({ key: candidate.key, itemId: created.data.id, title: candidate.title });
  }
  return { ok: true as const, imported };
}

export async function POST(request: Request) {
  let body: ApplyBody;
  try {
    body = (await request.json()) as ApplyBody;
  } catch {
    body = {};
  }

  if (!body.confirmApply) {
    const plan = await collectMondayImportPlan(true);
    return Response.json(
      {
        dryRun: true,
        error: {
          code: "confirm_apply_required",
          message: "Import Monday non execute. Renvoyer confirmApply=true pour creer le board et importer.",
        },
        plan,
      },
      { status: 409, headers: NO_STORE },
    );
  }

  const session = await getSession();
  if (!session?.isSuperadmin) {
    return Response.json(
      {
        dryRun: false,
        error: {
          code: "superadmin_required",
          message: "Import Monday refuse: session superadmin requise.",
        },
      },
      { status: 403, headers: NO_STORE },
    );
  }

  const plan = await collectMondayImportPlan(false);
  const limit = Math.max(1, Math.min(Number(body.limit || 80), 250));
  const candidates = plan.candidates.slice(0, limit);

  const shaped = await createBoardShape(body.boardName?.trim() || "MyBotIA - Production & Taches");
  if (!shaped.ok) {
    return Response.json({ dryRun: false, error: shaped.error, plan }, { status: 503, headers: NO_STORE });
  }

  const imported = await importCandidates(
    shaped.data.board.id,
    shaped.data.groups,
    shaped.data.columns,
    candidates,
  );

  if (!imported.ok) {
    return Response.json(
      { dryRun: false, board: shaped.data.board, imported: imported.imported, error: imported.error, plan },
      { status: 503, headers: NO_STORE },
    );
  }

  return Response.json(
    {
      dryRun: false,
      board: shaped.data.board,
      groups: shaped.data.groups,
      imported: imported.imported,
      skipped: Math.max(0, plan.candidates.length - candidates.length),
      warnings: plan.warnings,
    },
    { status: 201, headers: NO_STORE },
  );
}
