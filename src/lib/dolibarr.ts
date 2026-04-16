// Dolibarr CRM API client — server-side only (used in API routes)

const DOLIBARR_URL = process.env.DOLIBARR_URL!;
const DOLIBARR_API_KEY = process.env.DOLIBARR_API_KEY!;

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

async function dolibarrFetch<T>(endpoint: string): Promise<T> {
  const url = `${DOLIBARR_URL}/${endpoint}`;
  const res = await fetch(url, {
    headers: { DOLAPIKEY: DOLIBARR_API_KEY },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Dolibarr ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

async function dolibarrWrite<T>(
  endpoint: string,
  method: "POST" | "PUT" | "DELETE",
  body?: Record<string, unknown>
): Promise<T> {
  const url = `${DOLIBARR_URL}/${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: {
      DOLAPIKEY: DOLIBARR_API_KEY,
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

// --- Thirdparties (clients) ---

export async function getThirdParties(limit = 100): Promise<DolibarrThirdParty[]> {
  return dolibarrFetch<DolibarrThirdParty[]>(
    `thirdparties?sortfield=t.rowid&sortorder=ASC&limit=${limit}`
  );
}

export async function getThirdParty(id: string): Promise<DolibarrThirdParty> {
  return dolibarrFetch<DolibarrThirdParty>(`thirdparties/${id}`);
}

export async function getThirdPartyContacts(id: string): Promise<DolibarrContact[]> {
  try {
    return await dolibarrFetch<DolibarrContact[]>(
      `contacts?sqlfilters=(t.fk_soc:=:${id})&limit=50`
    );
  } catch {
    return [];
  }
}

// --- Projects ---

export async function getProjects(limit = 100): Promise<DolibarrProject[]> {
  return dolibarrFetch<DolibarrProject[]>(
    `projects?sortfield=t.rowid&sortorder=DESC&limit=${limit}`
  );
}

export async function getProject(id: string): Promise<DolibarrProject> {
  return dolibarrFetch<DolibarrProject>(`projects/${id}`);
}

// --- Events (agenda) ---

export async function getEvents(limit = 50): Promise<DolibarrEvent[]> {
  try {
    return await dolibarrFetch<DolibarrEvent[]>(
      `agendaevents?sortfield=t.datep&sortorder=DESC&limit=${limit}`
    );
  } catch {
    return [];
  }
}

export async function getThirdPartyEvents(socid: string): Promise<DolibarrEvent[]> {
  try {
    return await dolibarrFetch<DolibarrEvent[]>(
      `agendaevents?sqlfilters=(t.fk_soc:=:${socid})&sortfield=t.datep&sortorder=DESC&limit=20`
    );
  } catch {
    return [];
  }
}

// --- Invoices ---

export async function getInvoices(limit = 50): Promise<DolibarrInvoice[]> {
  try {
    return await dolibarrFetch<DolibarrInvoice[]>(
      `invoices?sortfield=t.rowid&sortorder=DESC&limit=${limit}`
    );
  } catch {
    return [];
  }
}

export async function getThirdPartyInvoices(socid: string): Promise<DolibarrInvoice[]> {
  try {
    return await dolibarrFetch<DolibarrInvoice[]>(
      `invoices?sqlfilters=(t.fk_soc:=:${socid})&sortfield=t.rowid&sortorder=DESC&limit=20`
    );
  } catch {
    return [];
  }
}

// --- Proposals (devis) ---

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

export async function getProposals(limit = 50): Promise<DolibarrProposal[]> {
  try {
    return await dolibarrFetch<DolibarrProposal[]>(
      `proposals?sortfield=t.rowid&sortorder=DESC&limit=${limit}`
    );
  } catch {
    return [];
  }
}

export async function getThirdPartyProposals(socid: string): Promise<DolibarrProposal[]> {
  try {
    return await dolibarrFetch<DolibarrProposal[]>(
      `proposals?sqlfilters=(t.fk_soc:=:${socid})&sortfield=t.rowid&sortorder=DESC&limit=20`
    );
  } catch {
    return [];
  }
}

// --- Contacts (all) ---

export async function getContacts(limit = 200): Promise<DolibarrContact[]> {
  try {
    return await dolibarrFetch<DolibarrContact[]>(
      `contacts?sortfield=t.rowid&sortorder=ASC&limit=${limit}`
    );
  } catch {
    return [];
  }
}

// --- Thirdparties filtered by category ---

export async function getThirdPartiesByCategory(
  categoryId: number
): Promise<DolibarrThirdParty[]> {
  try {
    const items = await dolibarrFetch<DolibarrThirdParty[]>(
      `categories/${categoryId}/objects?type=customer&limit=200`
    );
    return items;
  } catch {
    return [];
  }
}

// --- Projects filtered by thirdparty ---

export async function getThirdPartyProjects(socid: string): Promise<DolibarrProject[]> {
  try {
    return await dolibarrFetch<DolibarrProject[]>(
      `projects?sqlfilters=(t.fk_soc:=:${socid})&sortfield=t.rowid&sortorder=DESC&limit=20`
    );
  } catch {
    return [];
  }
}

// ============================================
// WRITE OPERATIONS (POST / PUT / DELETE)
// ============================================

// --- Thirdparties CRUD ---

export async function createThirdParty(data: {
  name: string;
  name_alias?: string;
  email?: string;
  phone?: string;
  address?: string;
  zip?: string;
  town?: string;
  country_code?: string;
  client?: string; // "1" = client, "0" = not
  prospect?: string; // "1" = prospect
  fournisseur?: string; // "1" = supplier
  note_public?: string;
  note_private?: string;
}): Promise<string> {
  return dolibarrWrite<string>("thirdparties", "POST", data);
}

export async function updateThirdParty(
  id: string,
  data: Record<string, unknown>
): Promise<unknown> {
  return dolibarrWrite("thirdparties/" + id, "PUT", data);
}

export async function assignThirdPartyCategory(
  thirdpartyId: string,
  categoryId: number
): Promise<unknown> {
  return dolibarrWrite(
    `categories/${categoryId}/objects/customer/${thirdpartyId}`,
    "POST"
  );
}

// --- Contacts CRUD ---

export async function createContact(data: {
  firstname: string;
  lastname: string;
  socid: string;
  email?: string;
  phone_pro?: string;
  phone_mobile?: string;
  poste?: string;
}): Promise<string> {
  return dolibarrWrite<string>("contacts", "POST", data);
}

export async function updateContact(
  id: string,
  data: Record<string, unknown>
): Promise<unknown> {
  return dolibarrWrite("contacts/" + id, "PUT", data);
}

// --- Projects CRUD ---

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
}): Promise<string> {
  return dolibarrWrite<string>("projects", "POST", data);
}

export async function updateProject(
  id: string,
  data: Record<string, unknown>
): Promise<unknown> {
  return dolibarrWrite("projects/" + id, "PUT", data);
}

export async function validateProject(id: string): Promise<unknown> {
  return dolibarrWrite(`projects/${id}/validate`, "POST", {});
}

// --- Tasks CRUD (Dolibarr project tasks) ---

export interface DolibarrTask {
  id: string;
  ref: string;
  label: string;
  description: string | null;
  fk_project: string;
  fk_task_parent: string;
  progress: string | null;
  date_start: number | string | null;
  date_end: number | string | null;
  planned_workload: number;
  duration_effective: number;
  datec: string | null;
  priority: string;
}

export async function getTasks(limit = 100): Promise<DolibarrTask[]> {
  try {
    return await dolibarrFetch<DolibarrTask[]>(
      `tasks?sortfield=t.rowid&sortorder=DESC&limit=${limit}`
    );
  } catch {
    return [];
  }
}

export async function getProjectTasks(
  projectId: string
): Promise<DolibarrTask[]> {
  try {
    return await dolibarrFetch<DolibarrTask[]>(
      `tasks?sqlfilters=(t.fk_projet:=:${projectId})&limit=50`
    );
  } catch {
    return [];
  }
}

export async function createTask(data: {
  label: string;
  fk_project: string;
  description?: string;
  date_start?: string;
  date_end?: string;
  planned_workload?: number;
  priority?: string;
}): Promise<string> {
  return dolibarrWrite<string>("tasks", "POST", data);
}

export async function updateTask(
  id: string,
  data: Record<string, unknown>
): Promise<unknown> {
  return dolibarrWrite("tasks/" + id, "PUT", data);
}

// --- Events CRUD ---

export async function createEvent(data: {
  label: string;
  type_code: string;
  datep: number;
  socid?: string;
  fk_project?: string;
  note_private?: string;
}): Promise<string> {
  return dolibarrWrite<string>("agendaevents", "POST", data);
}
