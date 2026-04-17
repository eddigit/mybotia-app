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

async function dolibarrFetch<T>(endpoint: string, tenant?: TenantConfig): Promise<T> {
  const cfg = tenant || getTenantConfig();
  const url = `${cfg.url}/${endpoint}`;
  const res = await fetch(url, {
    headers: { DOLAPIKEY: cfg.apiKey },
    next: { revalidate: 60 },
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
