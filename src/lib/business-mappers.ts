// V1.1.B Phase 1 — Adaptateurs business → shape Platform.
//
// mybotia-business expose ses entités en camelCase (sortie Drizzle), shape
// minimaliste. Le front Platform attend des `Client` / `Project` / `Task`
// enrichis (cf. `src/types/index.ts`). Ces mappers ajustent sans changer
// le contrat front, pour que la migration provider reste invisible.

import type { Client, Project, Task, ClientStatus, TaskStatus } from "@/types";

// --- Shapes business (telles que sérialisées par tenantHandler côté business) ---

export type BusinessClient = {
  id: string;
  tenantId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: "active" | "prospect" | "churned" | "supplier";
  notes: string | null;
  // V1.1.B agence digitale
  clientType?: string | null;
  priority?: string | null;
  whatsappJid?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BusinessProject = {
  id: string;
  tenantId: string;
  clientId: string;
  name: string;
  description: string | null;
  status: "active" | "paused" | "done" | "cancelled";
  dueDate: string | null;
  // V1.1.B agence digitale
  projectType?: string | null;
  priority?: string | null;
  repoGithubUrl?: string | null;
  vercelProjectUrl?: string | null;
  productionUrl?: string | null;
  stagingUrl?: string | null;
  domain?: string | null;
  nextAction?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BusinessTask = {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done" | "cancelled";
  dueDate: string | null;
  // V1.1.B agence digitale
  priority?: string | null;
  assignedTo?: string | null;
  category?: string | null;
  workflowStep?: string | null;
  githubIssueUrl?: string | null;
  githubPrUrl?: string | null;
  vercelDeploymentUrl?: string | null;
  whatsappThreadRef?: string | null;
  doneAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

// --- Helpers ---

function clientStatusToCockpit(s: BusinessClient["status"]): ClientStatus {
  // Platform n'a pas "supplier" → on traite comme actif côté UI, le flag
  // `isSupplier` porte la nuance.
  if (s === "supplier") return "active";
  if (s === "active" || s === "prospect" || s === "churned") return s;
  return "active";
}

function taskStatusToCockpit(s: BusinessTask["status"]): TaskStatus {
  if (s === "todo" || s === "in_progress" || s === "done") return s;
  if (s === "cancelled") return "blocked";
  return "todo";
}

function projectStatusToCockpit(s: BusinessProject["status"]): Project["status"] {
  if (s === "active" || s === "paused") return s;
  if (s === "done") return "completed";
  // cancelled → "paused" côté UI (Platform n'a pas de "cancelled")
  return "paused";
}

const PROJECT_COLORS = [
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
];

function projectColorFromIndex(i: number): string {
  return PROJECT_COLORS[i % PROJECT_COLORS.length];
}

function shortDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// --- Mappers exportés ---

export function mapBusinessClientToCockpit(
  c: BusinessClient,
  tenantSlug: string,
): Client {
  return {
    id: c.id,
    name: c.name,
    company: c.name,
    email: c.email ?? "",
    phone: c.phone ?? undefined,
    status: clientStatusToCockpit(c.status),
    lastContact: shortDate(c.updatedAt),
    notePublic: c.notes ?? undefined,
    isSupplier: c.status === "supplier",
    tenantSlug,
    // V1.1.B agence digitale
    clientType: c.clientType ?? undefined,
    priority: c.priority ?? undefined,
    whatsappJid: c.whatsappJid ?? undefined,
  };
}

export function mapBusinessProjectToCockpit(
  p: BusinessProject,
  i: number,
  clientName: string | undefined,
  tenantSlug: string,
): Project {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? undefined,
    status: projectStatusToCockpit(p.status),
    progress: 0,
    tasksTotal: 0,
    tasksDone: 0,
    members: [],
    dueDate: p.dueDate ?? undefined,
    color: projectColorFromIndex(i),
    clientId: p.clientId,
    clientName,
    tenantSlug,
    // V1.1.B agence digitale
    projectType: p.projectType ?? undefined,
    priority: p.priority ?? undefined,
    repoGithubUrl: p.repoGithubUrl ?? undefined,
    vercelProjectUrl: p.vercelProjectUrl ?? undefined,
    productionUrl: p.productionUrl ?? undefined,
    stagingUrl: p.stagingUrl ?? undefined,
    domain: p.domain ?? undefined,
    nextAction: p.nextAction ?? undefined,
  };
}

const TASK_PRIORITY_BUSINESS_TO_COCKPIT: Record<string, "low" | "medium" | "high" | "critical"> = {
  low: "low",
  medium: "medium",
  high: "high",
  urgent: "critical",
  critical: "critical",
};

export function mapBusinessTaskToCockpit(
  t: BusinessTask,
  projectName: string | undefined,
  clientName?: string | undefined,
): Task {
  const priorityMapped: "low" | "medium" | "high" | "critical" | undefined =
    t.priority ? TASK_PRIORITY_BUSINESS_TO_COCKPIT[t.priority] : undefined;
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? undefined,
    status: taskStatusToCockpit(t.status),
    priority: priorityMapped ?? "medium",
    dueDate: t.dueDate ?? undefined,
    projectId: t.projectId,
    projectName,
    clientName,
    createdAt: t.createdAt,
    // V1.1.B agence digitale
    category: t.category ?? undefined,
    workflowStep: t.workflowStep ?? undefined,
    assignedTo: t.assignedTo ?? undefined,
    githubIssueUrl: t.githubIssueUrl ?? undefined,
    githubPrUrl: t.githubPrUrl ?? undefined,
    vercelDeploymentUrl: t.vercelDeploymentUrl ?? undefined,
    whatsappThreadRef: t.whatsappThreadRef ?? undefined,
    doneAt: t.doneAt ?? undefined,
  };
}

// =============================================================================
// V1.1.B Phase 2 A2 — Inverse mapping : UI cockpit (shape Dolibarr legacy)
// → shape business pour POST/PATCH.
//
// Doctrine : on accepte les deux shapes (business-first + Dolibarr-legacy) côté
// route Platform, on filtre vers le shape business uniquement, on ignore
// silencieusement les champs Dolibarr non mappables (opp_*, note_public, ref,
// priority…). Si le résultat est vide, le caller doit retourner 400
// `no_supported_fields` pour ne pas faire un PATCH sans effet.
// =============================================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

function asNonEmptyString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/**
 * Convertit un dueDate venant de l'UI vers ISO `YYYY-MM-DD` accepté par
 * business. Accepte epoch (s, ms), ISO, "YYYY-MM-DD". Retourne `undefined`
 * si non parseable (=> on ignore le champ, pas d'erreur).
 */
function asBusinessDate(v: unknown): string | undefined {
  if (v === null) return null as unknown as string;
  if (v === undefined) return undefined;
  if (typeof v === "number") {
    const ms = v < 1e12 ? v * 1000 : v; // <1e12 ⇒ secondes
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    if (/^\d+$/.test(v)) {
      const n = parseInt(v, 10);
      const ms = n < 1e12 ? n * 1000 : n;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
    }
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
  }
  return undefined;
}

const PROJECT_STATUS_DOLIBARR_TO_BUSINESS: Record<string, BusinessProject["status"]> = {
  "0": "paused", // brouillon
  "1": "active",
  "2": "done",
};

function asBusinessProjectStatus(v: unknown): BusinessProject["status"] | undefined {
  if (typeof v !== "string") return undefined;
  if (["active", "paused", "done", "cancelled"].includes(v)) {
    return v as BusinessProject["status"];
  }
  return PROJECT_STATUS_DOLIBARR_TO_BUSINESS[v];
}

function asBusinessTaskStatus(v: unknown): BusinessTask["status"] | undefined {
  if (typeof v !== "string") return undefined;
  if (["todo", "in_progress", "done", "cancelled"].includes(v)) {
    return v as BusinessTask["status"];
  }
  return undefined;
}

export type BusinessProjectInput = {
  name?: string;
  description?: string | null;
  clientId?: string;
  dueDate?: string | null;
  status?: BusinessProject["status"];
  // V1.1.B agence digitale
  projectType?: string | null;
  priority?: string | null;
  repoGithubUrl?: string | null;
  vercelProjectUrl?: string | null;
  productionUrl?: string | null;
  stagingUrl?: string | null;
  domain?: string | null;
  nextAction?: string | null;
};

export type BusinessTaskInput = {
  title?: string;
  description?: string | null;
  projectId?: string;
  dueDate?: string | null;
  status?: BusinessTask["status"];
  // V1.1.B agence digitale
  priority?: string | null;
  assignedTo?: string | null;
  category?: string | null;
  workflowStep?: string | null;
  githubIssueUrl?: string | null;
  githubPrUrl?: string | null;
  vercelDeploymentUrl?: string | null;
  whatsappThreadRef?: string | null;
};

/**
 * Filtre/convertit un body Platform (shape Dolibarr ou business-first) vers
 * un payload business clients/contracts. Champs ignorés silencieusement :
 * `opp_*`, `note_public`, `note_private`, `ref`, `name_alias`, `town`,
 * `priority`, `progress`, `date_start`, etc.
 */
export function mapInputProjectFromUi(body: unknown): BusinessProjectInput {
  const out: BusinessProjectInput = {};
  if (!body || typeof body !== "object") return out;
  const b = body as Record<string, unknown>;

  const name = asNonEmptyString(b.name) ?? asNonEmptyString(b.title);
  if (name) out.name = name;

  if (b.description !== undefined) {
    if (typeof b.description === "string") out.description = b.description;
    else if (b.description === null) out.description = null;
  }

  const clientCandidate = b.clientId ?? b.socid;
  if (isUuid(clientCandidate)) out.clientId = clientCandidate;

  const due = b.dueDate !== undefined ? b.dueDate : b.date_end;
  if (due !== undefined) {
    const mapped = asBusinessDate(due);
    if (mapped !== undefined) out.dueDate = mapped;
  }

  const status = asBusinessProjectStatus(b.status);
  if (status) out.status = status;

  // V1.1.B agence digitale — passthrough simple (champs string optionnels)
  if (b.projectType !== undefined) out.projectType = (b.projectType as string) || null;
  if (b.priority !== undefined && b.priority !== "") out.priority = String(b.priority);
  if (b.repoGithubUrl !== undefined) out.repoGithubUrl = (b.repoGithubUrl as string) || null;
  if (b.vercelProjectUrl !== undefined) out.vercelProjectUrl = (b.vercelProjectUrl as string) || null;
  if (b.productionUrl !== undefined) out.productionUrl = (b.productionUrl as string) || null;
  if (b.stagingUrl !== undefined) out.stagingUrl = (b.stagingUrl as string) || null;
  if (b.domain !== undefined) out.domain = (b.domain as string) || null;
  if (b.nextAction !== undefined) out.nextAction = (b.nextAction as string) || null;

  return out;
}

export function mapInputTaskFromUi(body: unknown): BusinessTaskInput {
  const out: BusinessTaskInput = {};
  if (!body || typeof body !== "object") return out;
  const b = body as Record<string, unknown>;

  const title = asNonEmptyString(b.title) ?? asNonEmptyString(b.label);
  if (title) out.title = title;

  if (b.description !== undefined) {
    if (typeof b.description === "string") out.description = b.description;
    else if (b.description === null) out.description = null;
  }

  const projectCandidate = b.projectId ?? b.fk_project;
  if (isUuid(projectCandidate)) out.projectId = projectCandidate;

  const due = b.dueDate !== undefined ? b.dueDate : b.date_end;
  if (due !== undefined) {
    const mapped = asBusinessDate(due);
    if (mapped !== undefined) out.dueDate = mapped;
  }

  const status = asBusinessTaskStatus(b.status);
  if (status) out.status = status;

  // V1.1.B Phase 2 A4 — TaskEditPanel "Marquer comme terminé" envoie
  // {progress: "100"} (héritage Dolibarr). On convertit en status si status
  // absent. progress >= 100 → done, > 0 → in_progress, sinon todo.
  if (out.status === undefined && b.progress !== undefined) {
    const raw = b.progress;
    const num =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? parseInt(raw, 10)
          : NaN;
    if (!Number.isNaN(num)) {
      if (num >= 100) out.status = "done";
      else if (num > 0) out.status = "in_progress";
      else out.status = "todo";
    }
  }

  // V1.1.B agence digitale — passthrough simple
  if (b.priority !== undefined && b.priority !== "") out.priority = String(b.priority);
  if (b.assignedTo !== undefined) out.assignedTo = (b.assignedTo as string) || null;
  if (b.category !== undefined) out.category = (b.category as string) || null;
  if (b.workflowStep !== undefined) out.workflowStep = (b.workflowStep as string) || null;
  if (b.githubIssueUrl !== undefined) out.githubIssueUrl = (b.githubIssueUrl as string) || null;
  if (b.githubPrUrl !== undefined) out.githubPrUrl = (b.githubPrUrl as string) || null;
  if (b.vercelDeploymentUrl !== undefined) out.vercelDeploymentUrl = (b.vercelDeploymentUrl as string) || null;
  if (b.whatsappThreadRef !== undefined) out.whatsappThreadRef = (b.whatsappThreadRef as string) || null;

  return out;
}

export function isEmptyInput(input: Record<string, unknown>): boolean {
  for (const k in input) {
    if (input[k] !== undefined) return false;
  }
  return true;
}
