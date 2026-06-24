// Dolibarr CRM API client — multi-tenant routing
// Chaque tenant a son propre CRM Dolibarr avec URL et API key distincts.
// Aucune valeur secrète n'est admise dans ce fichier : tout vient de l'env.

export interface TenantConfig {
  /** Bloc 5B-fix — slug identifiant le tenant (clé du mapping). Permet aux routes
   *  multi-tenant (ex: PATCH /api/projects/[id]) de savoir quel tenant cibler. */
  slug?: string;
  url: string;
  apiKey: string;
  label: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Mapping tenant_slug → Dolibarr instance.
// Construit paresseusement : la première lecture exige la présence des env vars.
let _tenantCrmCache: Record<string, TenantConfig> | null = null;

function buildTenantCrm(): Record<string, TenantConfig> {
  return {
    mybotia: {
      slug: "mybotia",
      url: requireEnv("DOLIBARR_URL_MYBOTIA"),
      apiKey: requireEnv("DOLIBARR_KEY_MYBOTIA"),
      label: "MyBotIA",
    },
    vlmedical: {
      slug: "vlmedical",
      url: requireEnv("DOLIBARR_URL_VLMEDICAL"),
      apiKey: requireEnv("DOLIBARR_KEY_VLMEDICAL"),
      label: "VL Medical",
    },
    igh: {
      slug: "igh",
      url: requireEnv("DOLIBARR_URL_IGH"),
      apiKey: requireEnv("DOLIBARR_KEY_IGH"),
      label: "IGH",
    },
    cmb_lux: {
      slug: "cmb_lux",
      url: requireEnv("DOLIBARR_URL_CMBLUX"),
      apiKey: requireEnv("DOLIBARR_KEY_CMBLUX"),
      label: "CMB Conseil",
    },
  };
}

function getTenantCrm(): Record<string, TenantConfig> {
  if (_tenantCrmCache === null) {
    _tenantCrmCache = buildTenantCrm();
  }
  return _tenantCrmCache;
}

export function getTenantConfig(tenantSlug?: string | null): TenantConfig {
  if (tenantSlug === null || tenantSlug === undefined || tenantSlug === "") {
    // Requête anonyme (login public, page d'accueil) → fallback MyBotIA.
    // Toujours via env, jamais hardcodé.
    return {
      url: requireEnv("DOLIBARR_URL"),
      apiKey: requireEnv("DOLIBARR_API_KEY"),
      label: "MyBotIA",
    };
  }
  const cfg = getTenantCrm()[tenantSlug];
  if (!cfg) {
    // Tenant identifié mais non mappé → REFUS STRICT (pas de fallback silencieux).
    throw new Error(`Tenant non configuré: ${tenantSlug}`);
  }
  return cfg;
}

// Superadmin: retourne TOUTES les configs pour agréger
export function getAllTenantConfigs(): TenantConfig[] {
  return Object.values(getTenantCrm());
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
  // Bloc 5B-fix v2 — RACINE du bug "rien ne change" : Next.js mettait en cache
  // les réponses Dolibarr 60s côté serveur (`next: { revalidate: 60 }`). Un PATCH
  // suivi d'un refetch /api/dashboard ressortait alors la version cachée d'avant
  // la modification. On force `cache: "no-store"` par défaut. L'option `noCache`
  // reste lue pour rétro-compatibilité, mais elle n'a plus d'effet inverse.
  const res = await fetch(url, {
    headers: { DOLAPIKEY: cfg.apiKey },
    cache: "no-store",
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

// --- Bloc 5E — invoices/proposals liés à un projet (lecture seule pour drawer + garde-fous DELETE).
export async function getProjectInvoices(projectId: string, tenant?: TenantConfig): Promise<DolibarrInvoice[]> {
  try {
    return await dolibarrFetch<DolibarrInvoice[]>(
      `invoices?sqlfilters=(t.fk_projet:=:${projectId})&sortfield=t.rowid&sortorder=DESC&limit=50`,
      tenant
    );
  } catch { return []; }
}

export async function getProjectProposals(projectId: string, tenant?: TenantConfig): Promise<DolibarrProposal[]> {
  try {
    return await dolibarrFetch<DolibarrProposal[]>(
      `proposals?sqlfilters=(t.fk_projet:=:${projectId})&sortfield=t.rowid&sortorder=DESC&limit=50`,
      tenant
    );
  } catch { return []; }
}

// --- Thirdparties by category ---
export async function getThirdPartiesByCategory(categoryId: number, tenant?: TenantConfig): Promise<DolibarrThirdParty[]> {
  try { return await dolibarrFetch<DolibarrThirdParty[]>(`categories/${categoryId}/objects?type=customer&limit=200`, tenant); }
  catch { return []; }
}

// --- Commercial document details (proposal / invoice / credit_note) ---
// Détail unifié lecture seule pour la page /documents/[type]/[id].
// Côté MCP : tool dolibarr_get_commercial_document_details (sse-server.py).

export type CommercialDocumentType = "proposal" | "invoice" | "credit_note";

export interface CommercialDocumentLine {
  id: string;
  description: string;
  qty: string | null;
  unit: string | null;
  unitPriceHT: string | null;
  discountPercent: string | null;
  tvaTx: string | null;
  totalHT: string | null;
  totalTVA: string | null;
  totalTTC: string | null;
  productLabel: string;
}

export interface CommercialDocumentPayment {
  id: string;
  date: string | number | null;
  amount: string | number | null;
  type: string;
  ref: string;
}

export interface CommercialDocumentLink {
  id: string;
  ref: string;
  totalHT: string | null;
  type?: string;
}

export interface CommercialDocumentDetails {
  documentType: CommercialDocumentType;
  id: string;
  ref: string;
  client: { id: string; name: string; nameAlias: string; town: string; zip: string; email: string } | null;
  project: { id: string; ref: string; title: string } | null;
  date: number | string | null;
  dueDate: number | string | null;
  statusBusiness: string;
  statusPayment: "paid" | "unpaid" | null;
  totalHT: string | null;
  totalTVA: string | null;
  totalTTC: string | null;
  tvaDetail: { rate: string; baseHT: number; tva: number }[];
  remainToPay: number | null;
  pdfAvailable: boolean;
  pdfPath: string;
  lines: CommercialDocumentLine[];
  payments: CommercialDocumentPayment[];
  linked: {
    sourceProposal: CommercialDocumentLink | null;
    sourceInvoice: CommercialDocumentLink | null;
    invoices: CommercialDocumentLink[];
    creditNotes: CommercialDocumentLink[];
  };
  notePublic: string;
  invoiceType?: string;
}

const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  "0": "draft", "1": "validated", "2": "signed", "3": "refused", "4": "billed",
};
const INVOICE_STATUS_LABELS: Record<string, string> = {
  "0": "draft", "1": "unpaid", "2": "paid", "3": "abandoned",
};
const INVOICE_TYPE_LABELS: Record<string, string> = {
  "0": "standard", "1": "replacement", "2": "credit_note",
  "3": "deposit", "4": "proforma", "5": "situation",
};

interface RawDolibarrLine {
  id?: string; rowid?: string; desc?: string; description?: string;
  qty?: string; fk_unit?: string | null; subprice?: string;
  remise_percent?: string; tva_tx?: string;
  total_ht?: string; total_tva?: string; total_ttc?: string;
  product_label?: string; label?: string;
}
interface RawDolibarrInvoiceOrProposal {
  id?: string; ref?: string; socid?: string; type?: string;
  statut?: string; status?: string; paye?: string;
  total_ht?: string; total_tva?: string; total_ttc?: string;
  date?: number | string | null; datec?: number | string | null;
  date_lim_reglement?: number | string | null; fin_validite?: number | string | null;
  fk_project?: string | null; last_main_doc?: string | null;
  remaintopay?: string | number | null;
  note_public?: string;
  lines?: RawDolibarrLine[];
  linkedObjectsIds?: Record<string, string[]> | null;
  fk_facture_source?: string | null;
}

async function fetchProposalRaw(id: string, tenant?: TenantConfig): Promise<RawDolibarrInvoiceOrProposal> {
  return dolibarrFetch<RawDolibarrInvoiceOrProposal>(`proposals/${id}`, tenant);
}
async function fetchInvoiceRaw(id: string, tenant?: TenantConfig): Promise<RawDolibarrInvoiceOrProposal> {
  return dolibarrFetch<RawDolibarrInvoiceOrProposal>(`invoices/${id}`, tenant);
}
async function fetchInvoicePayments(id: string, tenant?: TenantConfig): Promise<RawDolibarrInvoiceOrProposal[]> {
  try { return await dolibarrFetch<RawDolibarrInvoiceOrProposal[]>(`invoices/${id}/payments`, tenant); }
  catch { return []; }
}

export async function getCommercialDocumentDetails(
  documentType: CommercialDocumentType,
  id: string,
  tenant?: TenantConfig,
): Promise<CommercialDocumentDetails> {
  const isInvoiceFamily = documentType === "invoice" || documentType === "credit_note";

  const doc = isInvoiceFamily ? await fetchInvoiceRaw(id, tenant) : await fetchProposalRaw(id, tenant);
  if (!doc?.id) throw new Error(`${documentType} id=${id} introuvable`);

  if (isInvoiceFamily) {
    const t = String(doc.type ?? "0");
    if (documentType === "credit_note" && t !== "2") {
      throw new Error(`Document id=${id} n'est pas un avoir (type Dolibarr=${t})`);
    }
    if (documentType === "invoice" && t === "2") {
      throw new Error(`Document id=${id} est un avoir, utiliser type 'credit_note'`);
    }
  }

  const [tp, project] = await Promise.all([
    doc.socid
      ? getThirdParty(doc.socid, tenant).catch(() => null)
      : Promise.resolve(null),
    doc.fk_project && String(doc.fk_project) !== "0"
      ? getProject(String(doc.fk_project), tenant).catch(() => null)
      : Promise.resolve(null),
  ]);

  const client = tp
    ? {
        id: String(tp.id),
        name: tp.name || "",
        nameAlias: tp.name_alias || "",
        town: tp.town || "",
        zip: tp.zip || "",
        email: tp.email || "",
      }
    : null;
  const projectOut = project
    ? { id: String(project.id), ref: project.ref || "", title: project.title || "" }
    : null;

  const rawStatus = String(doc.statut ?? doc.status ?? "");
  let statusBusiness: string;
  let statusPayment: "paid" | "unpaid" | null;
  if (documentType === "proposal") {
    statusBusiness = PROPOSAL_STATUS_LABELS[rawStatus] || rawStatus;
    statusPayment = null;
  } else {
    statusBusiness = INVOICE_STATUS_LABELS[rawStatus] || rawStatus;
    statusPayment = String(doc.paye ?? "0") === "1" ? "paid" : "unpaid";
  }

  const lines: CommercialDocumentLine[] = (doc.lines || []).map((ln) => ({
    id: String(ln.id || ln.rowid || ""),
    description: (ln.desc || ln.description || "").slice(0, 1500),
    qty: ln.qty ?? null,
    unit: ln.fk_unit ?? null,
    unitPriceHT: ln.subprice ?? null,
    discountPercent: ln.remise_percent ?? null,
    tvaTx: ln.tva_tx ?? null,
    totalHT: ln.total_ht ?? null,
    totalTVA: ln.total_tva ?? null,
    totalTTC: ln.total_ttc ?? null,
    productLabel: ln.product_label || ln.label || "",
  }));

  const tvaByRate: Record<string, { rate: string; baseHT: number; tva: number }> = {};
  for (const ln of doc.lines || []) {
    const rate = String(ln.tva_tx ?? "0");
    const ht = parseFloat(ln.total_ht ?? "0");
    const tva = parseFloat(ln.total_tva ?? "0");
    if (Number.isNaN(ht) || Number.isNaN(tva)) continue;
    const slot = tvaByRate[rate] ?? (tvaByRate[rate] = { rate, baseHT: 0, tva: 0 });
    slot.baseHT += ht;
    slot.tva += tva;
  }
  const tvaDetail = Object.values(tvaByRate).map((v) => ({
    rate: v.rate,
    baseHT: Math.round(v.baseHT * 100) / 100,
    tva: Math.round(v.tva * 100) / 100,
  }));

  const payments: CommercialDocumentPayment[] = isInvoiceFamily
    ? (await fetchInvoicePayments(id, tenant)).map((p) => ({
        id: String((p as unknown as { id?: string }).id || ""),
        date: (p as unknown as { date?: string | number; datepaye?: string | number }).date
          ?? (p as unknown as { datepaye?: string | number }).datepaye ?? null,
        amount: (p as unknown as { amount?: string | number }).amount ?? null,
        type: String((p as unknown as { type?: string; type_label?: string }).type
          || (p as unknown as { type_label?: string }).type_label || ""),
        ref: String((p as unknown as { ref?: string; num_payment?: string }).ref
          || (p as unknown as { num_payment?: string }).num_payment || ""),
      }))
    : [];

  const linked: CommercialDocumentDetails["linked"] = {
    sourceProposal: null, sourceInvoice: null, invoices: [], creditNotes: [],
  };
  const linkedIds = doc.linkedObjectsIds || {};
  if (linkedIds && typeof linkedIds === "object") {
    for (const [key, ids] of Object.entries(linkedIds)) {
      if (!Array.isArray(ids)) continue;
      if (key === "propal" && isInvoiceFamily) {
        for (const pid of ids) {
          const p = await fetchProposalRaw(String(pid), tenant).catch(() => null);
          if (p?.id) {
            linked.sourceProposal = { id: String(p.id), ref: p.ref || "", totalHT: p.total_ht ?? null };
            break;
          }
        }
      }
      if (key === "facture") {
        for (const iid of ids) {
          if (String(iid) === String(id)) continue;
          const inv = await fetchInvoiceRaw(String(iid), tenant).catch(() => null);
          if (!inv?.id) continue;
          const t = String(inv.type ?? "0");
          const link: CommercialDocumentLink = {
            id: String(inv.id), ref: inv.ref || "",
            totalHT: inv.total_ht ?? null,
            type: INVOICE_TYPE_LABELS[t] || t,
          };
          if (t === "2") linked.creditNotes.push(link);
          else linked.invoices.push(link);
        }
      }
    }
  }
  if (documentType === "credit_note" && doc.fk_facture_source) {
    const src = await fetchInvoiceRaw(String(doc.fk_facture_source), tenant).catch(() => null);
    if (src?.id) {
      linked.sourceInvoice = { id: String(src.id), ref: src.ref || "", totalHT: src.total_ht ?? null };
    }
  }

  let remainToPay: number | null = null;
  if (isInvoiceFamily) {
    const r = parseFloat(String(doc.remaintopay ?? ""));
    remainToPay = Number.isNaN(r) ? null : r;
  }

  const lastDoc = doc.last_main_doc || "";

  const out: CommercialDocumentDetails = {
    documentType,
    id: String(doc.id),
    ref: doc.ref || "",
    client,
    project: projectOut,
    date: doc.date ?? doc.datec ?? null,
    dueDate: doc.date_lim_reglement ?? doc.fin_validite ?? null,
    statusBusiness,
    statusPayment,
    totalHT: doc.total_ht ?? null,
    totalTVA: doc.total_tva ?? null,
    totalTTC: doc.total_ttc ?? null,
    tvaDetail,
    remainToPay,
    pdfAvailable: Boolean(lastDoc),
    pdfPath: lastDoc,
    lines,
    payments,
    linked,
    notePublic: (doc.note_public || "").slice(0, 2000),
  };
  if (isInvoiceFamily) {
    out.invoiceType = INVOICE_TYPE_LABELS[String(doc.type ?? "0")] || String(doc.type ?? "0");
  }
  return out;
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
  firstname?: string | null;
  lastname?: string | null;
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

async function dolibarrWrite<T>(endpoint: string, method: "POST" | "PUT" | "DELETE", body?: Record<string, unknown>, tenant?: TenantConfig): Promise<T> {
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

// Bloc 5B — update project (étape pipeline / montant / probabilité / titre / statut).
// Whitelist côté lib (defense in depth). La route /api/projects/[id] filtre
// aussi côté serveur. Aucun champ socid ici : le rattachement client se fait
// uniquement via createProject (Bloc fix BYRON).
// Bloc 5B-security : ajout du champ `status` Dolibarr (0=brouillon, 1=ouvert,
// 2=clôturé/archivé) pour permettre l'archivage via le même flow PATCH.
export async function updateProject(
  id: string,
  data: {
    opp_status?: string;
    opp_amount?: string | number;
    opp_percent?: string | number;
    title?: string;
    status?: string; // "0" | "1" | "2"
    description?: string;
    note_public?: string;
    note_private?: string;
  },
  tenant?: TenantConfig
): Promise<unknown> {
  return dolibarrWrite(`projects/${id}`, "PUT", data, tenant);
}

// Bloc 5B-security — DELETE projet. Dolibarr accepte DELETE /projects/{id}.
// Le serveur applique des garde-fous métier (cf route /api/projects/[id] DELETE).
export async function deleteProject(
  id: string,
  tenant?: TenantConfig
): Promise<unknown> {
  return dolibarrWrite(`projects/${id}`, "DELETE", undefined, tenant);
}

// Bloc 5B-security — DELETE tâche. Dolibarr accepte DELETE /tasks/{id}.
export async function deleteTask(
  id: string,
  tenant?: TenantConfig
): Promise<unknown> {
  return dolibarrWrite(`tasks/${id}`, "DELETE", undefined, tenant);
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
