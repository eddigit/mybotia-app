import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { getProjects, getTasks, getTenantConfig, getThirdParties, type TenantConfig } from "@/lib/dolibarr";

export type MondayImportSource =
  | "memory:lea"
  | "memory:product"
  | "mybotia-dolibarr"
  | "mybotia-business:trello";

export type MondayImportKind = "task" | "product";

export type MondayImportCandidate = {
  key: string;
  kind: MondayImportKind;
  client: string;
  project: string;
  title: string;
  status: string;
  owner: string;
  priority: string;
  value: string | null;
  dueDate: string | null;
  notes: string;
  source: MondayImportSource;
  sourcePath?: string;
  sourceUrl?: string;
};

export type MondayImportPlan = {
  generatedAt: string;
  dryRun: boolean;
  clients: string[];
  candidates: MondayImportCandidate[];
  counts: {
    total: number;
    bySource: Record<string, number>;
    byClient: Record<string, number>;
  };
  warnings: string[];
};

const DEFAULT_LEA_CLIENTS_DIR =
  "/Users/admin/MyBotIA V2/MyBotIA V2 Hostinger KMV8M/remote-vps2/pod-root-meta/pod-mybotia/agent-lea/workspace/clients";

const TARGET_CLIENTS = [
  { slug: "systemic", label: "Systemic" },
  { slug: "kibia", label: "Kibia" },
  { slug: "mp-conseil", label: "MP Conseil" },
  { slug: "mp-conseils", label: "MP Conseil" },
  { slug: "levinet", label: "Levinet" },
  { slug: "artroyal", label: "Art Royal" },
  { slug: "igh", label: "IGH" },
  { slug: "hannah-paypers", label: "Paypers" },
  { slug: "cmb_lux", label: "CMB Lux" },
];

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function addCandidate(
  out: MondayImportCandidate[],
  candidate: Omit<MondayImportCandidate, "key">,
): void {
  const key = normalizeKey(`${candidate.source}-${candidate.client}-${candidate.project}-${candidate.title}`);
  if (out.some((item) => item.key === key)) return;
  out.push({ key, ...candidate });
}

function memoryRoot(): string {
  return process.env.LEA_MEMORY_CLIENTS_DIR?.trim() || DEFAULT_LEA_CLIENTS_DIR;
}

function pickClientDirs(root: string): { slug: string; label: string; path: string }[] {
  if (!existsSync(root)) return [];
  const entries = readdirSync(root)
    .map((name) => ({ name, path: join(root, name) }))
    .filter((entry) => statSync(entry.path).isDirectory());

  return entries
    .map((entry) => {
      const match = TARGET_CLIENTS.find((client) => {
        const entryKey = normalizeKey(entry.name);
        return entryKey.includes(client.slug) || client.slug.includes(entryKey);
      });
      return match ? { slug: match.slug, label: match.label, path: entry.path } : null;
    })
    .filter((entry): entry is { slug: string; label: string; path: string } => Boolean(entry));
}

function extractMemoryTasks(filePath: string, client: string): MondayImportCandidate[] {
  const text = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const out: MondayImportCandidate[] = [];
  let currentProject = client;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^#{1,4}\s+/.test(line) && /projet|production|dashboard|mvp|site|agent|laia|lucy|jarvis/i.test(line)) {
      currentProject = line.replace(/^#{1,4}\s+/, "").slice(0, 120);
      continue;
    }
    const taskLike =
      /^[-*]\s+\[[ xX]\]\s+/.test(line) ||
      /^[-*]\s+(TACHE|TÂCHE|TODO|A faire|À faire|Relancer|Préparer|Verifier|Vérifier|Créer|Creer|Mettre|Envoyer)/i.test(line) ||
      /^\d+\.\s+/.test(line);
    if (!taskLike) continue;

    const cleaned = line
      .replace(/^[-*]\s+\[[ xX]\]\s+/, "")
      .replace(/^[-*]\s+/, "")
      .replace(/^\d+\.\s+/, "")
      .replace(/\*\*/g, "")
      .trim();
    if (cleaned.length < 8) continue;

    addCandidate(out, {
      client,
      project: currentProject,
      title: cleaned.slice(0, 180),
      status: /fait|termin|envoye|envoyé|ok|✅/i.test(cleaned) ? "Termine" : "A faire",
      owner: /lea|léa/i.test(cleaned) ? "Lea" : "Gilles",
      priority: /urgent|critique|bloqu/i.test(cleaned) ? "Haute" : "Normale",
      kind: "task",
      value: null,
      dueDate: null,
      notes: cleaned,
      source: "memory:lea",
      sourcePath: filePath,
    });
  }

  return out;
}

const DEFAULT_MYBOTIA_PRODUCTS = [
  {
    client: "MyBotIA",
    project: "Catalogue offres MyBotIA",
    title: "Agent IA métier personnalisé",
    value: "Abonnement mensuel + mise en place selon périmètre",
    notes: "Agent IA dédié client, mémoire métier, canaux de communication et pilotage opérationnel.",
  },
  {
    client: "MyBotIA",
    project: "Catalogue offres MyBotIA",
    title: "Interface web / portail client IA",
    value: "One-shot ou inclus dans offre globale",
    notes: "Application ou portail métier relié aux agents, aux données client et aux workflows.",
  },
  {
    client: "MyBotIA",
    project: "Catalogue offres MyBotIA",
    title: "CRM / production Dolibarr augmenté IA",
    value: "Paramétrage + exploitation",
    notes: "Structuration tiers, projets, tâches, facturation et pilotage production avec assistance IA.",
  },
  {
    client: "MyBotIA",
    project: "Catalogue offres MyBotIA",
    title: "Connecteurs WhatsApp, Telegram, Gmail et documents",
    value: "Selon connecteurs et volume",
    notes: "Connexion des canaux de travail à l'agent métier avec règles de brouillon et GO explicite.",
  },
  {
    client: "MyBotIA",
    project: "Catalogue offres MyBotIA",
    title: "Maintenance évolutive IA et sécurité",
    value: "Abonnement récurrent",
    notes: "Suivi API, modèles, secrets, déploiements, incidents, qualité et continuité opérationnelle.",
  },
];

function extractValue(line: string): string | null {
  const money = line.match(/(?:\d[\d\s.,]*\s*(?:EUR|€|euros?)(?:\s*HT|\s*TTC)?(?:\s*\/\s*(?:mois|an|jour))?)/i);
  if (money?.[0]) return money[0].replace(/\s+/g, " ").trim();
  const subscription = line.match(/(?:abonnement|forfait|mise en place|setup|site web|maintenance)[^:]*:\s*(.+)$/i);
  return subscription?.[1]?.slice(0, 120).trim() || null;
}

function extractMemoryProducts(filePath: string, client: string): MondayImportCandidate[] {
  const text = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const out: MondayImportCandidate[] = [];
  let currentProject = "Produits / offres";

  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/\*\*/g, "");
    if (!line) continue;
    if (/^#{1,4}\s+/.test(line) && /offre|tarif|contrat|budget|abonnement|produit|service|proposition/i.test(line)) {
      currentProject = line.replace(/^#{1,4}\s+/, "").slice(0, 120);
      continue;
    }
    const productLike =
      /(?:prestation|forfait|abonnement|mise en place|setup|site web|agent ia|maintenance|offre|tarif|budget|catalogue|commission|mensuel|jour)/i.test(line) &&
      /(?:\d[\d\s.,]*\s*(?:EUR|€)|abonnement|forfait|prestation|mise en place|site web|agent ia|maintenance)/i.test(line);
    if (!productLike) continue;

    const cleaned = line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").trim();
    if (cleaned.length < 12) continue;
    addCandidate(out, {
      kind: "product",
      client,
      project: currentProject,
      title: cleaned.slice(0, 180),
      status: /accept|signe|signé|factur|valid/i.test(cleaned) ? "Valide" : "A qualifier",
      owner: "Gilles",
      priority: /urgent|bloqu|critique/i.test(cleaned) ? "Haute" : "Normale",
      value: extractValue(cleaned),
      dueDate: null,
      notes: cleaned,
      source: "memory:product",
      sourcePath: filePath,
    });
  }

  return out;
}

export async function collectLeaMemoryCandidates(): Promise<{
  candidates: MondayImportCandidate[];
  warnings: string[];
}> {
  const root = memoryRoot();
  const warnings: string[] = [];
  const out: MondayImportCandidate[] = [];
  if (!existsSync(root)) {
    return {
      candidates: [],
      warnings: [`Memoire Lea introuvable: ${root}`],
    };
  }

  const dirs = pickClientDirs(root);
  if (dirs.length === 0) warnings.push("Aucun dossier client cible trouve dans la memoire Lea.");

  for (const dir of dirs) {
    for (const fileName of ["profil.md", "historique.md", "MEMORY.md"]) {
      const filePath = join(dir.path, fileName);
      if (!existsSync(filePath)) continue;
      out.push(...extractMemoryTasks(filePath, dir.label));
      out.push(...extractMemoryProducts(filePath, dir.label));
    }
  }

  for (const product of DEFAULT_MYBOTIA_PRODUCTS) {
    addCandidate(out, {
      kind: "product",
      status: "Catalogue",
      owner: "Gilles",
      priority: "Normale",
      dueDate: null,
      source: "memory:product",
      ...product,
    });
  }

  return { candidates: out, warnings };
}

function mapTenantClient(slug: string): string {
  if (slug === "igh") return "IGH";
  if (slug === "cmb_lux") return "CMB Lux";
  return "MyBotIA";
}

async function collectDolibarrTenant(tenant: TenantConfig): Promise<MondayImportCandidate[]> {
  const [thirdParties, projects, tasks] = await Promise.all([
    getThirdParties(200, tenant).catch(() => []),
    getProjects(200, tenant).catch(() => []),
    getTasks(300, tenant, { notDoneOnly: true }).catch(() => []),
  ]);
  const clientById = new Map(thirdParties.map((client) => [client.id, client.name_alias || client.name]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const out: MondayImportCandidate[] = [];

  for (const project of projects) {
    const clientName = clientById.get(project.socid) || project.thirdparty_name || mapTenantClient(tenant.slug || "mybotia");
    if (!TARGET_CLIENTS.some((target) => normalizeKey(clientName).includes(target.slug) || normalizeKey(project.title).includes(target.slug))) continue;
    addCandidate(out, {
      client: clientName,
      kind: "task",
      project: project.title || project.ref,
      title: `Suivre production/projet: ${project.title || project.ref}`,
      status: project.status === "1" ? "En cours" : "A faire",
      owner: "Gilles",
      priority: "Normale",
      value: null,
      dueDate: null,
      notes: project.description || project.note_private || project.note_public || "",
      source: "mybotia-dolibarr",
    });
  }

  for (const task of tasks) {
    const project = projectById.get(task.fk_project);
    const projectName = project?.title || project?.ref || "Taches MyBotIA";
    const clientName = project ? clientById.get(project.socid) || project.thirdparty_name || mapTenantClient(tenant.slug || "mybotia") : mapTenantClient(tenant.slug || "mybotia");
    if (!TARGET_CLIENTS.some((target) => normalizeKey(clientName).includes(target.slug) || normalizeKey(projectName).includes(target.slug))) continue;
    const progress = Number.parseFloat(task.progress || "0");
    addCandidate(out, {
      client: clientName,
      kind: "task",
      project: projectName,
      title: task.label,
      status: progress >= 100 ? "Termine" : progress > 0 ? "En cours" : "A faire",
      owner: "Gilles",
      priority: task.priority === "2" ? "Haute" : task.priority === "1" ? "Normale" : "Basse",
      value: null,
      dueDate: null,
      notes: task.description || "",
      source: "mybotia-dolibarr",
    });
  }

  return out;
}

export async function collectDolibarrCandidates(): Promise<{
  candidates: MondayImportCandidate[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  const tenants = ["mybotia", "igh", "cmb_lux"];
  const out: MondayImportCandidate[] = [];

  for (const slug of tenants) {
    try {
      out.push(...(await collectDolibarrTenant(getTenantConfig(slug))));
    } catch (error) {
      warnings.push(`Dolibarr ${slug} indisponible: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { candidates: out, warnings };
}

export async function collectBusinessTrelloCandidates(): Promise<{
  candidates: MondayImportCandidate[];
  warnings: string[];
}> {
  const endpoint = process.env.MYBOTIA_BUSINESS_TRELLO_EXPORT_URL?.trim();
  if (!endpoint) {
    return {
      candidates: [],
      warnings: ["Export Trello MyBotIA Business non configure: MYBOTIA_BUSINESS_TRELLO_EXPORT_URL absent."],
    };
  }

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as { cards?: Array<Record<string, unknown>> };
    const out: MondayImportCandidate[] = [];
    for (const card of payload.cards || []) {
      const client = String(card.client || card.clientName || "MyBotIA");
      const project = String(card.project || card.projectName || card.listName || "Trello");
      const title = String(card.name || card.title || "");
      if (!title) continue;
      addCandidate(out, {
        kind: "task",
        client,
        project,
        title,
        status: String(card.status || card.listName || "A faire"),
        owner: String(card.owner || card.assignee || "Gilles"),
        priority: String(card.priority || "Normale"),
        value: null,
        dueDate: typeof card.due === "string" ? card.due.slice(0, 10) : null,
        notes: String(card.desc || ""),
        source: "mybotia-business:trello",
        sourceUrl: typeof card.url === "string" ? card.url : undefined,
      });
    }
    return { candidates: out, warnings: [] };
  } catch (error) {
    return {
      candidates: [],
      warnings: [`Export Trello MyBotIA Business indisponible: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

export async function collectMondayImportPlan(dryRun = true): Promise<MondayImportPlan> {
  const [memory, dolibarr, trello] = await Promise.all([
    collectLeaMemoryCandidates(),
    collectDolibarrCandidates(),
    collectBusinessTrelloCandidates(),
  ]);
  const candidates: MondayImportCandidate[] = [];
  for (const candidate of [...memory.candidates, ...dolibarr.candidates, ...trello.candidates]) {
    addCandidate(candidates, candidate);
  }

  const bySource: Record<string, number> = {};
  const byClient: Record<string, number> = {};
  for (const candidate of candidates) {
    bySource[candidate.source] = (bySource[candidate.source] || 0) + 1;
    byClient[candidate.client] = (byClient[candidate.client] || 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    dryRun,
    clients: [...new Set(candidates.map((candidate) => candidate.client))].sort(),
    candidates,
    counts: {
      total: candidates.length,
      bySource,
      byClient,
    },
    warnings: [...memory.warnings, ...dolibarr.warnings, ...trello.warnings],
  };
}

export function mondayColumnValuesForCandidate(
  candidate: MondayImportCandidate,
  columns: Record<string, string>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  if (columns.client) values[columns.client] = candidate.client;
  if (columns.project) values[columns.project] = candidate.project;
  if (columns.status) values[columns.status] = candidate.status;
  if (columns.owner) values[columns.owner] = candidate.owner;
  if (columns.priority) values[columns.priority] = candidate.priority;
  if (columns.kind) values[columns.kind] = candidate.kind === "product" ? "Produit / offre" : "Tache";
  if (columns.value && candidate.value) values[columns.value] = candidate.value;
  if (columns.source) values[columns.source] = candidate.source;
  if (columns.notes) values[columns.notes] = candidate.notes.slice(0, 1800);
  if (columns.sourceUrl && candidate.sourceUrl) values[columns.sourceUrl] = candidate.sourceUrl;
  if (columns.sourcePath && candidate.sourcePath) values[columns.sourcePath] = candidate.sourcePath;
  if (columns.dueDate && candidate.dueDate) values[columns.dueDate] = { date: candidate.dueDate };
  return values;
}
