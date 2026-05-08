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
  };
}

export function mapBusinessTaskToCockpit(
  t: BusinessTask,
  projectName: string | undefined,
): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? undefined,
    status: taskStatusToCockpit(t.status),
    priority: "medium",
    dueDate: t.dueDate ?? undefined,
    projectId: t.projectId,
    projectName,
    createdAt: t.createdAt,
  };
}
