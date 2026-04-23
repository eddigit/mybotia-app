// Dolibarr CRM API client — multi-tenant routing
// Chaque tenant a son propre CRM Dolibarr avec URL et API key distincts

export interface TenantConfig {
  url: string;
  apiKey: string;
  label: string;
}

// Mapping tenant_slug → Dolibarr instance
const TENANT_CRM: Record<string, TenantConfig> = {
  mybotia: {
    url: process.env.DOLIBARR_URL_MYBOTIA || "https://crm-mybotia.mybotia.com/api/index.php",
    apiKey: process.env.DOLIBARR_KEY_MYBOTIA || "doli_lea_tenant_b02e3a5868d646cd033da4175809b585",
    label: "MyBotIA",
  },
  vlmedical: {
    url: process.env.DOLIBARR_URL_VLMEDICAL || "https://crm-vlmedical.mybotia.com/api/index.php",
    apiKey: process.env.DOLIBARR_KEY_VLMEDICAL || "doli_max_tenant_baf51a9b22c02ae5433da48c2b476489",
    label: "VL Medical",
  },
  igh: {
    url: process.env.DOLIBARR_URL_IGH || "https://crm-igh.mybotia.com/api/index.php",
    apiKey: process.env.DOLIBARR_KEY_IGH || "doli_lucy_tenant_5c31ea581c85d5ac93ebc5e4654c654e",
    label: "IGH",
  },
};

// Fallback pour les anciens env vars (compatibilité)
const FALLBACK_URL = process.env.DOLIBARR_URL || "https://crm-mybotia.mybotia.com/api/index.php";
const FALLBACK_KEY = process.env.DOLIBARR_API_KEY || "doli_lea_tenant_b02e3a5868d646cd033da4175809b585";

export function getTenantConfig(tenantSlug?: string | null): TenantConfig {
  if (tenantSlug && TENANT_CRM[tenantSlug]) {
    return TENANT_CRM[tenantSlug];
  }
  return { url: FALLBACK_URL, apiKey: FALLBACK_KEY, label: "MyBotIA" };
}

// Superadmin: retourne TOUTES les configs pour agréger
export function getAllTenantConfigs(): TenantConfig[] {
  return Object.values(TENANT_CRM);
}

export interface DolibarrThirdParty {
  id: string;
  name: string;
  name_alias: string;
  email: string | null;
  phone: string | null;
  phone_mobile: string | null;
  status: string;
  address: string | null;
  zip: string | null;
  town: string | null;
  country_code: string | null;
  note_private: string | null;
  note_public: string | null;
  date_creation: number | null;
  date_modification: string | null;
  client: string;
  prospect: string;
  fournisseur: string;
  code_client: string | null;
  url: string | null;
}

export interface DolibarrProject {
  id: string;
  ref: string;
  title: string;
  description: string | null;
  status: string;
  socid: string;
  thirdparty_name: string | null;
  budget_amount: string | null;
  date_start: number | string | null;
  date_end: number | string | null;
  note_private: string | null;
  note_public: string | null;
  usage_task: number;
  usage_opportunity: number;
  opp_amount: string | null;
  opp_percent: string | null;
  opp_status: string | null;
}

export interface DolibarrContact {
  id: string;
  firstname: string;
  lastname: string;
  email: string | null;
  phone_pro: string | null;
  phone_mobile: string | null;
  socid: string;
  socname: string | null;
  poste: string | null;
  civility_code: string | null;
}

export interface DolibarrEvent {
  id: string;
  label: string;
  type_code: string;
  datep: number | string | null;
  datef: number | string | null;
  note_private: string | null;
  socid: string | null;
  fk_project: string | null;
  userownerid: string | null;
}

export interface DolibarrInvoice {
  id: string;
  ref: string;
  socid: string;
  total_ht: string;
  total_tva: string;
  total_ttc: string;
  status: string;
  date: number | string | null;
  date_lim_reglement: number | string | null;
  paye: string;
}

export interface DolibarrProposal {
  id: string;
  ref: string;
  socid: string;
  total_ht: string;
  total_tva: string;
  total_ttc: string;
  statut: string;
  date: number | string | null;
  fin_validite: number | string | null;
}

async function dolibarrFetch<T>(
  endpoint: string,
  tenant?: TenantConfig,
  opts: { noCache?: boolean } = {}
): Promise<T> {
  const cfg = tenant || getTenantConfig();
  const url = `${cfg.url}/${endpoint}`;
  const res = await fetch(url, {
    headers: { DOLAPIKEY: cfg.apiKey },
    ...(opts.noCache ? { cache: "no-store" } : { next: { revalidate: 60 } }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Dolibarr ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

// --- Thirdparties ---
export async function getThirdParties(limit = 100, tenant?: TenantConfig): Promise<DolibarrThirdParty[]> {
  return dolibarrFetch<DolibarrThirdParty[]>(`thirdparties?sortfield=t.rowid&sortorder=ASC&limit=${limit}`, tenant);
}

export async function getThirdParty(id: string, tenant?: TenantConfig): Promise<DolibarrThirdParty> {
  return dolibarrFetch<DolibarrThirdParty>(`thirdparties/${id}`, tenant);
}

export async function getThirdPartyContacts(id: string, tenant?: TenantConfig): Promise<DolibarrContact[]> {
  try { return await dolibarrFetch<DolibarrContact[]>(`contacts?sqlfilters=(t.fk_soc:=:${id})&limit=50`, tenant); }
  catch { return []; }
}

// --- Projects ---
export async function getProjects(limit = 100, tenant?: TenantConfig): Promise<DolibarrProject[]> {
  return dolibarrFetch<DolibarrProject[]>(`projects?sortfield=t.rowid&sortorder=DESC&limit=${limit}`, tenant);
}

export async function getProject(id: string, tenant?: TenantConfig): Promise<DolibarrProject> {
  return dolibarrFetch<DolibarrProject>(`projects/${id}`, tenant);
}

// --- Events ---
export async function getEvents(limit = 50, tenant?: TenantConfig): Promise<DolibarrEvent[]> {
  try { return await dolibarrFetch<DolibarrEvent[]>(`agendaevents?sortfield=t.datep&sortorder=DESC&limit=${limit}`, tenant); }
  catch { return []; }
}

export async function getThirdPartyEvents(socid: string, tenant?: TenantConfig): Promise<DolibarrEvent[]> {
  try { return await dolibarrFetch<DolibarrEvent[]>(`agendaevents?sqlfilters=(t.fk_soc:=:${socid})&sortfield=t.datep&sortorder=DESC&limit=20`, tenant); }
  catch { return []; }
}

// --- Invoices ---
export async function getInvoices(limit = 50, tenant?: TenantConfig): Promise<DolibarrInvoice[]> {
  try { return await dolibarrFetch<DolibarrInvoice[]>(`invoices?sortfield=t.rowid&sortorder=DESC&limit=${limit}`, tenant); }
  catch { return []; }
}

export async function getThirdPartyInvoices(socid: string, tenant?: TenantConfig): Promise<DolibarrInvoice[]> {
  try { return await dolibarrFetch<DolibarrInvoice[]>(`invoices?sqlfilters=(t.fk_soc:=:${socid})&sortfield=t.rowid&sortorder=DESC&limit=20`, tenant); }
  catch { return []; }
}

// --- Proposals ---
export async function getProposals(limit = 50, tenant?: TenantConfig): Promise<DolibarrProposal[]> {
  try { return await dolibarrFetch<DolibarrProposal[]>(`proposals?sortfield=t.rowid&sortorder=DESC&limit=${limit}`, tenant); }
  catch { return []; }
}

export async function getThirdPartyProposals(socid: string, tenant?: TenantConfig): Promise<DolibarrProposal[]> {
  try { return await dolibarrFetch<DolibarrProposal[]>(`proposals?sqlfilters=(t.fk_soc:=:${socid})&sortfield=t.rowid&sortorder=DESC&limit=20`, tenant); }
  catch { return []; }
}

// --- Contacts ---
export async function getContacts(limit = 200, tenant?: TenantConfig): Promise<DolibarrContact[]> {
  try { return await dolibarrFetch<DolibarrContact[]>(`contacts?sortfield=t.rowid&sortorder=ASC&limit=${limit}`, tenant); }
  catch { return []; }
}

// --- Projects by thirdparty ---
export async function getThirdPartyProjects(socid: string, tenant?: TenantConfig): Promise<DolibarrProject[]> {
  try { return await dolibarrFetch<DolibarrProject[]>(`projects?sqlfilters=(t.fk_soc:=:${socid})&sortfield=t.rowid&sortorder=DESC&limit=20`, tenant); }
  catch { return []; }
}

// --- Thirdparties by category ---
export async function getThirdPartiesByCategory(categoryId: number, tenant?: TenantConfig): Promise<DolibarrThirdParty[]> {
  try { return await dolibarrFetch<DolibarrThirdParty[]>(`categories/${categoryId}/objects?type=customer&limit=200`, tenant); }
  catch { return []; }
}

// --- Tasks ---
export interface DolibarrTask {
  id: string;
  ref: string;
  label: string;
  description: string | null;
  fk_project: string;
  fk_task_parent: string;
  fk_user_creat: string | null;
  progress: string | null;
  date_start: number | string | null;
  date_end: number | string | null;
  planned_workload: number;
  duration_effective: number;
  datec: string | null;
  priority: string;
}

export interface GetTasksOptions {
  /** Filtre SQL : ne retourne que les tâches avec `datee <= dueBeforeOrEqual` (date ISO `YYYY-MM-DD`). */
  dueBeforeOrEqual?: string;
  /** Filtre SQL : exclut les tâches où `progress >= 100`. */
  notDoneOnly?: boolean;
}

export async function getTasks(
  limit = 100,
  tenant?: TenantConfig,
  opts: GetTasksOptions = {}
): Promise<DolibarrTask[]> {
  const filters: string[] = [];
  if (opts.dueBeforeOrEqual) {
    filters.push(`(t.datee:<=:'${opts.dueBeforeOrEqual} 23:59:59')`);
  }
  if (opts.notDoneOnly) {
    filters.push(`((t.progress:<:100) or (t.progress:is:NULL))`);
  }
  const qs = new URLSearchParams({
    sortfield: "t.datee",
    sortorder: "ASC",
    limit: String(limit),
  });
  if (filters.length) qs.set("sqlfilters", filters.join(" and "));
  try { return await dolibarrFetch<DolibarrTask[]>(`tasks?${qs.toString()}`, tenant, { noCache: true }); }
  catch { return []; }
}

// --- Task contacts (assignees) ---
export interface DolibarrTaskContact {
  id: string;
  rowid?: string;
  source: string;
  socid?: string | null;
  fk_socpeople?: string | null;
  code: string; // 'TASKEXECUTIVE' etc
  libelle?: string;
  email?: string | null;
  login?: string | null;
}

export async function getTaskContacts(
  taskId: string,
  tenant?: TenantConfig
): Promise<DolibarrTaskContact[]> {
  // Dolibarr 23's /tasks/{id}/contacts `type` query param is mis-routed to the
  // contact code (e.g. TASKEXECUTIVE) instead of the source filter. Pass none
  // and filter on `source`/`code` client-side when needed.
  try { return await dolibarrFetch<DolibarrTaskContact[]>(`tasks/${taskId}/contacts`, tenant, { noCache: true }); }
  catch { return []; }
}

export async function addTaskContact(
  taskId: string,
  userId: string,
  tenant?: TenantConfig,
  code: string = "TASKEXECUTIVE",
  source: "internal" | "external" = "internal"
): Promise<unknown> {
  return dolibarrWrite(
    `tasks/${taskId}/contacts?fk_socpeople=${userId}&type_contact=${encodeURIComponent(code)}&source=${source}`,
    "POST",
    undefined,
    tenant
  );
}

// --- Users (for session → Dolibarr user resolution) ---
export interface DolibarrUser {
  id: string;
  login: string;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
}

export async function getUserByEmail(email: string, tenant?: TenantConfig): Promise<DolibarrUser | null> {
  if (!email) return null;
  const safe = email.replace(/'/g, "");
  try {
    const list = await dolibarrFetch<DolibarrUser[]>(
      `users?sqlfilters=${encodeURIComponent(`(t.email:=:'${safe}')`)}&limit=1`,
      tenant
    );
    return Array.isArray(list) && list.length ? list[0] : null;
  } catch {
    return null;
  }
}

// ============================================
// WRITE OPERATIONS (POST / PUT)
// ============================================

async function dolibarrWrite<T>(endpoint: string, method: "POST" | "PUT", body?: Record<string, unknown>, tenant?: TenantConfig): Promise<T> {
  const cfg = tenant || getTenantConfig();
  const url = `${cfg.url}/${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: {
      DOLAPIKEY: cfg.apiKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Dolibarr ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

export async function createContact(data: {
  firstname: string;
  lastname: string;
  socid: string;
  email?: string;
  phone_pro?: string;
  phone_mobile?: string;
  poste?: string;
}, tenant?: TenantConfig): Promise<string> {
  return dolibarrWrite<string>("contacts", "POST", data, tenant);
}

export async function updateContact(id: string, data: Record<string, unknown>, tenant?: TenantConfig): Promise<unknown> {
  return dolibarrWrite("contacts/" + id, "PUT", data, tenant);
}

export async function createProject(data: {
  ref: string;
  title: string;
  socid?: string;
  description?: string;
  date_start?: string;
  date_end?: string;
  budget_amount?: string;
  usage_task?: number;
  usage_opportunity?: number;
  opp_amount?: string;
  opp_percent?: string;
}, tenant?: TenantConfig): Promise<string> {
  return dolibarrWrite<string>("projects", "POST", data, tenant);
}

export async function validateProject(id: string, tenant?: TenantConfig): Promise<unknown> {
  return dolibarrWrite(`projects/${id}/validate`, "POST", {}, tenant);
}

export async function createTask(data: {
  label: string;
  fk_project: string;
  description?: string;
  date_start?: string;
  date_end?: string;
  planned_workload?: number;
  priority?: string;
  ref?: string;
}, tenant?: TenantConfig): Promise<string> {
  // Dolibarr requires `ref`. "auto" triggers server-side auto-numbering via PROJECT_TASK_ADDON.
  const body = { ref: "auto", ...data };
  return dolibarrWrite<string>("tasks", "POST", body, tenant);
}

export async function updateTask(id: string, data: Record<string, unknown>, tenant?: TenantConfig): Promise<unknown> {
  return dolibarrWrite("tasks/" + id, "PUT", data, tenant);
}
