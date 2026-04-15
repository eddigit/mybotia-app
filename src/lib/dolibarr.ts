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
