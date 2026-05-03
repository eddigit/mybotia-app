// Mappers: Dolibarr API objects → MyBotIA app types

import type { Client, Project, Deal, Activity, Metric } from "@/types";
import type {
  DolibarrThirdParty,
  DolibarrProject,
  DolibarrEvent,
  DolibarrInvoice,
  DolibarrProposal,
} from "./dolibarr";

// --- Helpers ---

function parseDate(raw: number | string | null | undefined): string {
  if (!raw) return "";
  if (typeof raw === "number") {
    return new Date(raw * 1000).toISOString();
  }
  return raw;
}

function formatDateShort(raw: number | string | null | undefined): string {
  if (!raw) return "";
  const d =
    typeof raw === "number" ? new Date(raw * 1000) : new Date(raw);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

// --- Thirdparty → Client ---

function inferClientStatus(tp: DolibarrThirdParty): Client["status"] {
  if (tp.status === "0") return "churned"; // inactive
  if (tp.prospect === "1") return "prospect";
  if (tp.client === "1") return "active";
  return "prospect"; // default for entities that are neither client nor prospect
}

function inferClientTags(tp: DolibarrThirdParty): string[] {
  const tags: string[] = [];
  if (tp.client === "1") tags.push("Client");
  if (tp.prospect === "1") tags.push("Prospect");
  if (tp.fournisseur === "1") tags.push("Fournisseur");
  if (tp.town) tags.push(tp.town);
  return tags;
}

export function mapThirdPartyToClient(tp: DolibarrThirdParty): Client {
  return {
    id: tp.id,
    name: tp.name_alias || tp.name,
    company: tp.name,
    email: tp.email || "",
    phone: tp.phone || tp.phone_mobile || undefined,
    status: inferClientStatus(tp),
    lastContact: formatDateShort(tp.date_modification || tp.date_creation),
    tags: inferClientTags(tp),
    town: tp.town || undefined,
    countryCode: tp.country_code || undefined,
    notePublic: tp.note_public || undefined,
    notePrivate: tp.note_private || undefined,
    isSupplier: tp.fournisseur === "1",
  };
}

// --- Project → Project ---

function projectStatus(
  s: string
): "active" | "paused" | "completed" {
  switch (s) {
    case "0":
      return "paused"; // draft
    case "1":
      return "active"; // validated/open
    case "2":
      return "completed"; // closed
    default:
      return "active";
  }
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

export function mapDolibarrProject(
  dp: DolibarrProject,
  index: number,
  clientName?: string,
  tenantSlug?: string
): Project {
  const status = projectStatus(dp.status);
  const budget = parseFloat(dp.budget_amount || "0");
  return {
    id: dp.id,
    name: dp.title || dp.ref,
    ref: dp.ref,
    description: dp.description || undefined,
    status,
    progress: status === "completed" ? 100 : status === "paused" ? 0 : 50,
    tasksTotal: 0,
    tasksDone: 0,
    members: [],
    dueDate: formatDateShort(dp.date_end) || undefined,
    color: PROJECT_COLORS[index % PROJECT_COLORS.length],
    budget: budget > 0 ? budget : undefined,
    clientId: dp.socid || undefined,
    clientName: clientName || dp.thirdparty_name || undefined,
    tenantSlug,
  };
}

// --- Project with opportunity → Deal ---

const STAGE_MAP: Record<string, Deal["stage"]> = {
  "1": "discovery",
  "2": "proposal",
  "3": "negotiation",
  "4": "negotiation",
  "5": "closing",
  "6": "won",
  "7": "lost",
};

// Bloc 5B — mapping inverse UI → Dolibarr opp_status (codes natifs).
// "negotiation" = 3 ou 4 côté Dolibarr ; on choisit canoniquement 3.
// Un projet déjà à 4 reste à 4 sauf modification explicite via select.
export const STAGE_TO_OPP_STATUS: Record<Deal["stage"], string> = {
  discovery: "1",
  proposal: "2",
  negotiation: "3",
  closing: "5",
  won: "6",
  lost: "7",
};

export function mapProjectToDeal(
  dp: DolibarrProject,
  clientName: string,
  tenantSlug?: string
): Deal | null {
  const amount = parseFloat(dp.opp_amount || dp.budget_amount || "0");
  if (amount <= 0) return null;

  return {
    id: `deal-${dp.id}`,
    projectId: dp.id,
    tenantSlug,
    title: dp.title || dp.ref,
    clientId: dp.socid,
    clientName,
    stage: STAGE_MAP[dp.opp_status || ""] || "discovery",
    value: amount,
    probability: parseFloat(dp.opp_percent || "50"),
    expectedClose: formatDateShort(dp.date_end) || undefined,
  };
}

// --- Event → Activity ---

const EVENT_TYPE_MAP: Record<string, Activity["type"]> = {
  AC_OTH: "system",
  AC_OTH_AUTO: "system",
  AC_TEL: "message",
  AC_EMAIL: "message",
  AC_RDV: "meeting",
  AC_COM: "message",
};

export function mapEventToActivity(
  ev: DolibarrEvent,
  clientNameById?: Record<string, string>,
  projectTitleById?: Record<string, string>,
  projectTitleByRef?: Record<string, string>,
  tenantSlug?: string
): Activity {
  const clientId = ev.socid || undefined;
  let title = ev.label || "Evenement";

  // Si l'evenement est lie a un projet, remplacer la reference (PJ...) par l'intitule
  if (ev.fk_project && projectTitleById && projectTitleById[ev.fk_project]) {
    const projectTitle = projectTitleById[ev.fk_project];
    // Remplacer toute occurrence de PJXXXX-XXXX dans le label par le titre
    title = title.replace(/PJ\d+-\d+/g, `"${projectTitle}"`);
  } else if (projectTitleByRef) {
    // Fallback : remplacer la reference dans le label si on la trouve dans le mapping
    title = title.replace(/PJ\d+-\d+/g, (match) => {
      return projectTitleByRef[match] ? `"${projectTitleByRef[match]}"` : match;
    });
  }

  return {
    id: `ev-${ev.id}`,
    type: EVENT_TYPE_MAP[ev.type_code] || "system",
    title,
    description: ev.note_private || undefined,
    timestamp: parseDate(ev.datep) || new Date().toISOString(),
    clientId,
    clientName: clientId && clientNameById ? clientNameById[clientId] : undefined,
    tenantSlug,
  };
}

// --- Proposal → mapped for display ---

export interface MappedProposal {
  id: string;
  ref: string;
  total: number;
  status: "draft" | "validated" | "signed" | "refused" | "billed";
  date: string;
  expiryDate: string;
  /** Bloc 5C — tenant Dolibarr d'origine pour cockpit tenant-scopé. */
  tenantSlug?: string;
  clientId?: string;
  clientName?: string;
}

/** Bloc 5C — invoice mappée pour le cockpit (lecture, pas de write/delete). */
export interface MappedInvoice {
  id: string;
  ref: string;
  total: number;
  status: "draft" | "sent" | "paid" | "late";
  date: string;
  dueDate?: string;
  daysOverdue?: number;
  tenantSlug?: string;
  clientId?: string;
  clientName?: string;
}

const PROPOSAL_STATUS: Record<string, MappedProposal["status"]> = {
  "0": "draft",
  "1": "validated",
  "2": "signed",
  "3": "refused",
  "4": "billed",
};

export function mapProposal(
  p: DolibarrProposal,
  tenantSlug?: string,
  clientName?: string
): MappedProposal {
  return {
    id: p.id,
    ref: p.ref,
    total: parseFloat(p.total_ttc || "0"),
    status: PROPOSAL_STATUS[p.statut] || "draft",
    date: formatDateShort(p.date),
    expiryDate: formatDateShort(p.fin_validite),
    tenantSlug,
    clientId: p.socid || undefined,
    clientName,
  };
}

// Bloc 5C — mapping facture pour le cockpit. Lecture seule, jamais delete.
export function mapInvoice(
  inv: DolibarrInvoice,
  tenantSlug?: string,
  clientName?: string
): MappedInvoice {
  const total = parseFloat(inv.total_ttc || "0");
  const paye = inv.paye === "1";
  const dueRaw = inv.date_lim_reglement;
  const dueDate = dueRaw
    ? new Date(typeof dueRaw === "number" ? dueRaw * 1000 : dueRaw)
        .toISOString()
        .slice(0, 10)
    : undefined;
  const today = new Date().toISOString().slice(0, 10);
  let status: MappedInvoice["status"];
  let daysOverdue: number | undefined;
  if (paye) status = "paid";
  else if (inv.status === "0") status = "draft";
  else if (dueDate && dueDate < today) {
    status = "late";
    const ms = new Date(today).getTime() - new Date(dueDate).getTime();
    daysOverdue = Math.max(1, Math.floor(ms / 86400000));
  } else status = "sent";

  return {
    id: inv.id,
    ref: inv.ref,
    total,
    status,
    date: formatDateShort(inv.date),
    dueDate,
    daysOverdue,
    tenantSlug,
    clientId: inv.socid || undefined,
    clientName,
  };
}

// --- Dashboard metrics ---

export function computeMetrics(
  clients: Client[],
  projects: Project[],
  deals: Deal[],
  invoices: DolibarrInvoice[]
): Metric[] {
  const activeClients = clients.filter((c) => c.status === "active").length;
  const pipelineTotal = deals.reduce((sum, d) => sum + d.value, 0);
  const activeProjects = projects.filter((p) => p.status === "active").length;

  const paidInvoices = invoices.filter((i) => i.paye === "1");
  const totalRevenue = paidInvoices.reduce(
    (sum, i) => sum + parseFloat(i.total_ttc || "0"),
    0
  );

  return [
    {
      id: "metric-clients",
      label: "Clients actifs",
      value: activeClients,
      trend: "stable" as const,
    },
    {
      id: "metric-pipeline",
      label: "Pipeline commercial",
      value: `${Math.round(pipelineTotal).toLocaleString("fr-FR")} EUR`,
      trend: "up" as const,
    },
    {
      id: "metric-projects",
      label: "Projets actifs",
      value: activeProjects,
      trend: "stable" as const,
    },
    {
      id: "metric-revenue",
      label: "CA facture",
      value: `${Math.round(totalRevenue).toLocaleString("fr-FR")} EUR`,
      trend: "stable" as const,
    },
  ];
}
