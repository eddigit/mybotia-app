/**
 * V1.1.I-A — Phase 2C — Script import P0 mybotia_business
 *
 * Sources :
 *   - Workspace Léa : /opt/mybotia/agents/lea/workspace/clients/<slug>/profil.md
 *   - JID index    : /opt/mybotia/agents/lea/workspace/clients/jid_index.json
 *   - Tâches       : /opt/mybotia/agents/lea/workspace/06_STATE/PENDING_TASKS.md
 *   - Dolibarr     : docker exec mybotia-mariadb mariadb (lecture seule)
 *
 * Modes :
 *   npx tsx scripts/import/v11i-a-p0-import.ts          → dry-run (défaut)
 *   npx tsx scripts/import/v11i-a-p0-import.ts --apply  → apply réel
 *
 * Tenant cible : mybotia (583bc4d2-48d0-4089-a365-ccc18de00d83)
 */

import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { Client as PgClient } from "pg";
import yaml from "js-yaml";

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = "583bc4d2-48d0-4089-a365-ccc18de00d83";
const APPLY = process.argv.includes("--apply");

const WORKSPACE_ROOT = "/opt/mybotia/agents/lea/workspace/clients";
const JID_INDEX_PATH = path.join(WORKSPACE_ROOT, "jid_index.json");
const PENDING_TASKS_PATH =
  "/opt/mybotia/agents/lea/workspace/06_STATE/PENDING_TASKS.md";

// Slugs mybotia scope uniquement (hors igh, vlmedical, cmb_lux)
const MYBOTIA_SLUGS = [
  "artroyal",
  "byron",
  "clarisse-surin",
  "clement-delpiano",
  "clemsen",
  "cousin-jo",
  "emrise",
  "gilles",
  "hamono",
  "hannah-paypers",
  "herve-boussaid",
  "latin",
  "levinet",
  "maggia",
  "martine-etf",
  "nazaretti",
  "rachel",
  "systemic",
  "tobiana",
  "xavier",
];

// Clients Dolibarr sans dossier Léa (rowid connu, scope mybotia uniquement)
const DOLIBARR_ONLY_ROWIDS = [3, 9, 20, 11]; // Salzer, Marguet, Prugnier, Love Hotel

// Mapping type profil → client_type DB
const TYPE_MAP: Record<string, string> = {
  CLIENT: "b2b",
  PERSO: "b2c",
  PROSPECT: "b2b",
  INTERNE: "b2b",
  PATRON: "b2b",
  DEMO: "b2b",
};

// Mapping statut profil → status DB
const STATUS_MAP: Record<string, string> = {
  ACTIF: "active",
  INACTIF: "archived",
  STANDBY: "active",
  TERMINE: "archived",
  PROSPECT: "prospect",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfilFrontmatter {
  client_id?: string;
  nom?: string;
  type?: string;
  statut?: string;
  ton?: string;
  contact_principal?: string;
  telephone?: string;
  email?: string;
  siret?: string;
  jid_whatsapp?: string | string[];
  groupes_whatsapp?: string | string[];
  gateway?: string;
  forfait?: string;
  date_debut?: string;
}

interface ClientRecord {
  lea_slug: string;
  name: string;
  email: string | null;
  phone: string | null;
  client_type: string;
  status: string;
  ton: string | null;
  contact_name: string | null;
  jids: { jid: string; group_name: string | null }[];
  dolibarr_societe_id: number | null;
  dolibarr_town: string | null;
  dolibarr_country_code: string | null;
  source: "workspace" | "dolibarr_only";
  parse_error?: string;
}

interface DolibarrSociete {
  rowid: number;
  nom: string;
  email: string | null;
  siren: string | null;
  siret: string | null;
  town: string | null;
  phone: string | null;
}

interface DolibarrContact {
  rowid: number;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  phone: string | null;
  fk_soc: number;
}

interface PendingTask {
  due_date: string;
  client_label: string;
  lea_slug_hint: string | null;
  description: string;
  raw: string;
}

interface DryRunResult {
  clients: {
    record: ClientRecord;
    action: "CREATE" | "UPDATE" | "SKIP";
    existing_id?: string;
    conflict_reason?: string;
  }[];
  dolibarr_only: {
    societe: DolibarrSociete;
    action: "CREATE" | "UPDATE" | "SKIP";
    existing_id?: string;
  }[];
  tasks: PendingTask[];
  parse_errors: { slug: string; error: string }[];
  counts: {
    clients_create: number;
    clients_update: number;
    clients_skip: number;
    contacts: number;
    jids: number;
    tasks: number;
  };
}

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(msg: string) {
  const ts = new Date().toISOString();
  process.stdout.write(`[${ts}] ${msg}\n`);
}

function warn(msg: string) {
  process.stdout.write(`[WARN] ${msg}\n`);
}

function err(msg: string) {
  process.stdout.write(`[ERR]  ${msg}\n`);
}

// ─── Dolibarr Queries (via docker exec, read-only) ───────────────────────────

function dolibarrQuery(sql: string): string {
  try {
    const result = execFileSync(
      "docker",
      [
        "exec",
        "mybotia-mariadb",
        "mariadb",
        "-u",
        "dolibarr",
        "-pMyB0t1a_Doli_2026!",
        "--skip-column-names",
        "--batch",
        "dolibarr_mybotia",
        "-e",
        sql,
      ],
      { encoding: "utf-8", timeout: 15000 }
    );
    return result;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Dolibarr query failed: ${msg}`);
  }
}

function parseDolibarrRows(raw: string): string[][] {
  return raw
    .trim()
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => l.split("\t").map((v) => (v === "NULL" ? "" : v.trim())));
}

function loadDolibarrSocietes(): DolibarrSociete[] {
  log("Loading Dolibarr llx_societe (entity=1)...");
  const sql =
    "SELECT rowid, nom, email, siren, siret, town, phone FROM llx_societe WHERE entity=1 ORDER BY rowid;";
  const raw = dolibarrQuery(sql);
  return parseDolibarrRows(raw).map((r) => ({
    rowid: parseInt(r[0], 10),
    nom: r[1] || "",
    email: r[2] || null,
    siren: r[3] || null,
    siret: r[4] || null,
    town: r[5] || null,
    phone: r[6] || null,
  }));
}

function loadDolibarrContacts(): DolibarrContact[] {
  log("Loading Dolibarr llx_socpeople (entity=1)...");
  const sql =
    "SELECT rowid, firstname, lastname, email, phone, fk_soc FROM llx_socpeople WHERE entity=1 ORDER BY fk_soc, rowid;";
  const raw = dolibarrQuery(sql);
  return parseDolibarrRows(raw).map((r) => ({
    rowid: parseInt(r[0], 10),
    firstname: r[1] || null,
    lastname: r[2] || null,
    email: r[3] || null,
    phone: r[4] || null,
    fk_soc: parseInt(r[5], 10),
  }));
}

// ─── Workspace Parsing ────────────────────────────────────────────────────────

function extractFrontmatter(content: string): {
  data: ProfilFrontmatter;
  error?: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return { data: {}, error: "No YAML frontmatter found" };
  }
  try {
    const data = yaml.load(match[1]) as ProfilFrontmatter;
    return { data: data || {} };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { data: {}, error: `YAML parse error: ${msg}` };
  }
}

function normalizeJids(
  raw: string | string[] | null | undefined
): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map((j) => String(j).trim());
  if (typeof raw === "string" && raw.trim() !== "") return [raw.trim()];
  return [];
}

function mapClientRecord(
  slug: string,
  fm: ProfilFrontmatter,
  jidIndex: Record<string, string>,
  doliSocietes: DolibarrSociete[]
): ClientRecord {
  const rawJids = normalizeJids(fm.jid_whatsapp);
  const rawGroups = normalizeJids(fm.groupes_whatsapp);

  // Also collect JIDs from jid_index that map to this slug
  const indexJids = Object.entries(jidIndex)
    .filter(([, s]) => s === slug)
    .map(([jid]) => jid);

  // Merge: use profil.md JIDs first, then add index-only JIDs
  const mergedJidSet = new Set([...rawJids, ...indexJids]);
  const allJids = Array.from(mergedJidSet);

  const jids = allJids.map((jid, i) => ({
    jid,
    group_name: i < rawGroups.length ? rawGroups[i] : null,
  }));

  // Match Dolibarr societe by email
  const email = fm.email?.trim() || null;
  let doliMatch: DolibarrSociete | undefined;
  if (email) {
    doliMatch = doliSocietes.find(
      (s) => s.email && s.email.toLowerCase() === email.toLowerCase()
    );
  }
  // Fallback: match by nom similarity for known aliases
  if (!doliMatch) {
    const slugToDoliRowid: Record<string, number> = {
      "artroyal": 5,
      "clarisse-surin": 2,
      "clement-delpiano": 6,
      "levinet": 4,
      "martine-etf": 7,
      "hannah-paypers": 10,
      "systemic": 16,
      "byron": 17,
      "gilles": 26,
      "cousin-jo": 22,
      "latin": 23,
    };
    const rowid = slugToDoliRowid[slug];
    if (rowid) {
      doliMatch = doliSocietes.find((s) => s.rowid === rowid);
    }
  }

  return {
    lea_slug: slug,
    name: fm.nom?.trim() || slug,
    email,
    phone: fm.telephone?.trim() || (doliMatch?.phone ?? null) || null,
    client_type: TYPE_MAP[fm.type?.toUpperCase() || ""] || "b2b",
    status:
      fm.type?.toUpperCase() === "PROSPECT"
        ? "prospect"
        : STATUS_MAP[fm.statut?.toUpperCase() || ""] || "active",
    ton: fm.ton?.trim() || null,
    contact_name: fm.contact_principal?.trim() || null,
    jids,
    dolibarr_societe_id: doliMatch?.rowid ?? null,
    dolibarr_town: doliMatch?.town ?? null,
    dolibarr_country_code: doliMatch ? "FR" : null, // fk_pays=1 = France for entity=1
    source: "workspace",
  };
}

function loadWorkspaceClients(
  jidIndex: Record<string, string>,
  doliSocietes: DolibarrSociete[]
): { records: ClientRecord[]; errors: { slug: string; error: string }[] } {
  const records: ClientRecord[] = [];
  const errors: { slug: string; error: string }[] = [];

  for (const slug of MYBOTIA_SLUGS) {
    const profilPath = path.join(WORKSPACE_ROOT, slug, "profil.md");
    if (!fs.existsSync(profilPath)) {
      warn(`profil.md not found for slug=${slug}, skipping`);
      errors.push({ slug, error: "profil.md not found" });
      continue;
    }

    try {
      const content = fs.readFileSync(profilPath, "utf-8");
      const { data: fm, error: parseErr } = extractFrontmatter(content);

      if (parseErr) {
        warn(`Parse error for ${slug}: ${parseErr}`);
        errors.push({ slug, error: parseErr });
        // Still attempt partial import with empty fm
      }

      const record = mapClientRecord(slug, fm, jidIndex, doliSocietes);
      if (parseErr) record.parse_error = parseErr;
      records.push(record);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      err(`Fatal read error for ${slug}: ${msg}`);
      errors.push({ slug, error: `Read error: ${msg}` });
    }
  }

  return { records, errors };
}

// ─── JID Index ────────────────────────────────────────────────────────────────

function loadJidIndex(): Record<string, string> {
  try {
    const raw = fs.readFileSync(JID_INDEX_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed.index || {};
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    warn(`Could not load JID index: ${msg}`);
    return {};
  }
}

// ─── Pending Tasks ────────────────────────────────────────────────────────────

// Slug aliases to resolve task labels to lea_slug
const LABEL_TO_SLUG: Record<string, string | null> = {
  "byron": "byron",
  "pascal": "byron",
  "latin": "latin",
  "le latin": "latin",
  "aymen": "latin",
  "clément delpiano": "clement-delpiano",
  "clement delpiano": "clement-delpiano",
  "valérie": "clement-delpiano",
  "tobiana": "tobiana",
  "hamono": "hamono",
  "martine etf": "martine-etf",
  "martine": "martine-etf",
  "art royal": "artroyal",
  "artroyal": "artroyal",
  "tristan": "artroyal",
  "systemic": "systemic",
  "hubert": "systemic",
  "nazaretti": "nazaretti",
  "clemsen": "clemsen",
  "emrise": "emrise",
  "rachel": "rachel",
  "gilles": "gilles",
  "xavier": "xavier",
  "herve boussaid": "herve-boussaid",
  "harvey": "herve-boussaid",
  "hannah": "hannah-paypers",
  "hannah paypers": "hannah-paypers",
  "levinet": "levinet",
  "maggia": "maggia",
  "cousin jo": "cousin-jo",
  "clarisse surin": "clarisse-surin",
  "marguet": null, // dolibarr-only, no lea_slug
  "bruno marguet": null,
};

function resolveSlugFromLabel(label: string): string | null {
  const normalized = label.toLowerCase().trim().replace(/[*_]/g, "");
  // Try exact match
  if (normalized in LABEL_TO_SLUG) return LABEL_TO_SLUG[normalized] || null;
  // Try partial match
  for (const [key, slug] of Object.entries(LABEL_TO_SLUG)) {
    if (normalized.includes(key)) return slug || null;
  }
  return null;
}

function parsePendingTasks(content: string): PendingTask[] {
  const tasks: PendingTask[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const match = line.match(
      /^-\s+\[\s*\]\s+(\d{4}-\d{2}-\d{2})\s+[—–-]+\s+\*?\*?([^:*]+)\*?\*?\s*[:\-]\s*(.+)$/
    );
    if (!match) continue;

    const [, due_date, labelRaw, descRaw] = match;
    const client_label = labelRaw.trim().replace(/\*+/g, "");
    const description = descRaw.trim();
    const lea_slug_hint = resolveSlugFromLabel(client_label);

    tasks.push({
      due_date,
      client_label,
      lea_slug_hint,
      description,
      raw: line.trim(),
    });
  }

  return tasks;
}

// ─── PostgreSQL helpers ───────────────────────────────────────────────────────

async function makePgClient(): Promise<PgClient> {
  const pg = new PgClient({
    host: process.env.PG_HOST || "127.0.0.1",
    port: parseInt(process.env.PG_PORT || "5432", 10),
    database: process.env.PG_DATABASE || "mybotia_core",
    user: process.env.PG_USER || "mybotia",
    password:
      process.env.PG_PASSWORD ||
      "DrIrdLmyZPXAZJnuQiX5b37GlyhPwUH54AJG5KXDlCt3Qdbb",
  });
  await pg.connect();
  // Bypass RLS for import (superuser connection)
  await pg.query(`SET app.tenant_id = '${TENANT_ID}'`);
  return pg;
}

interface ExistingClient {
  id: string;
  name: string;
  email: string | null;
  lea_slug: string | null;
  dolibarr_societe_id: number | null;
}

async function loadExistingClients(pg: PgClient): Promise<ExistingClient[]> {
  const res = await pg.query<ExistingClient>(
    `SELECT id, name, email, lea_slug, dolibarr_societe_id
     FROM mybotia_business.clients
     WHERE tenant_id = $1`,
    [TENANT_ID]
  );
  return res.rows;
}

// ─── Dedup Logic ─────────────────────────────────────────────────────────────

function findExistingClient(
  record: { lea_slug?: string | null; email?: string | null },
  existing: ExistingClient[]
): ExistingClient | undefined {
  // 1. Match by lea_slug
  if (record.lea_slug) {
    const bySlug = existing.find(
      (e) => e.lea_slug && e.lea_slug === record.lea_slug
    );
    if (bySlug) return bySlug;
  }
  // 2. Match by email
  if (record.email) {
    const byEmail = existing.find(
      (e) =>
        e.email && e.email.toLowerCase() === record.email!.toLowerCase()
    );
    if (byEmail) return byEmail;
  }
  return undefined;
}

// ─── Dry-Run Analysis ─────────────────────────────────────────────────────────

async function runDryRun(
  workspaceRecords: ClientRecord[],
  doliSocietes: DolibarrSociete[],
  tasks: PendingTask[],
  parseErrors: { slug: string; error: string }[],
  pg: PgClient
): Promise<DryRunResult> {
  const existing = await loadExistingClients(pg);
  log(
    `Found ${existing.length} existing clients in mybotia_business for tenant mybotia`
  );

  const result: DryRunResult = {
    clients: [],
    dolibarr_only: [],
    tasks,
    parse_errors: parseErrors,
    counts: {
      clients_create: 0,
      clients_update: 0,
      clients_skip: 0,
      contacts: 0,
      jids: 0,
      tasks: tasks.length,
    },
  };

  // Workspace clients
  for (const record of workspaceRecords) {
    const found = findExistingClient(record, existing);
    let action: "CREATE" | "UPDATE" | "SKIP" = "CREATE";
    let existing_id: string | undefined;

    if (found) {
      // Art Royal triplon check: if both lea_slug AND email match the same record, UPDATE
      action = "UPDATE";
      existing_id = found.id;
    }

    if (action === "CREATE") result.counts.clients_create++;
    else if (action === "UPDATE") result.counts.clients_update++;
    else result.counts.clients_skip++;

    // Count contacts
    if (record.contact_name) result.counts.contacts++;
    // Count JIDs
    result.counts.jids += record.jids.length;

    result.clients.push({ record, action, existing_id });
  }

  // Dolibarr-only clients
  for (const rowid of DOLIBARR_ONLY_ROWIDS) {
    const societe = doliSocietes.find((s) => s.rowid === rowid);
    if (!societe) {
      warn(`Dolibarr rowid=${rowid} not found in loaded societes, skipping`);
      continue;
    }

    const found = findExistingClient({ email: societe.email }, existing);
    let action: "CREATE" | "UPDATE" | "SKIP" = "CREATE";
    let existing_id: string | undefined;

    if (found) {
      action = "UPDATE";
      existing_id = found.id;
    }

    if (action === "CREATE") result.counts.clients_create++;
    else if (action === "UPDATE") result.counts.clients_update++;
    else result.counts.clients_skip++;

    // Primary contact from llx_socpeople (loaded separately)
    result.counts.contacts++;

    result.dolibarr_only.push({ societe, action, existing_id });
  }

  return result;
}

// ─── Apply ────────────────────────────────────────────────────────────────────

interface ApplyResult {
  inserted_clients: number;
  updated_clients: number;
  inserted_contacts: number;
  inserted_jids: number;
  inserted_tasks: number;
  sentinel_project_id: string;
  conflicts: string[];
}

async function runApply(
  workspaceRecords: ClientRecord[],
  doliSocietes: DolibarrSociete[],
  doliContacts: DolibarrContact[],
  tasks: PendingTask[],
  pg: PgClient
): Promise<ApplyResult> {
  const result: ApplyResult = {
    inserted_clients: 0,
    updated_clients: 0,
    inserted_contacts: 0,
    inserted_jids: 0,
    inserted_tasks: 0,
    sentinel_project_id: "",
    conflicts: [],
  };

  await pg.query("BEGIN");

  try {
    // Bypass RLS: use SET LOCAL so it's transaction-scoped
    await pg.query(`SET LOCAL app.tenant_id = '${TENANT_ID}'`);

    // ── Step 1: Upsert workspace clients ────────────────────────────────────
    const clientSlugToId: Map<string, string> = new Map();

    for (const record of workspaceRecords) {
      try {
        // ON CONFLICT on lea_slug unique index
        const upsertRes = await pg.query<{ id: string; xmax: string }>(
          `INSERT INTO mybotia_business.clients
             (tenant_id, name, email, phone, client_type, status, ton, lea_slug,
              dolibarr_societe_id, town, country_code, notes, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
           ON CONFLICT (tenant_id, lea_slug) WHERE lea_slug IS NOT NULL
           DO UPDATE SET
             name                = EXCLUDED.name,
             email               = COALESCE(EXCLUDED.email, mybotia_business.clients.email),
             phone               = COALESCE(EXCLUDED.phone, mybotia_business.clients.phone),
             client_type         = EXCLUDED.client_type,
             status              = EXCLUDED.status,
             ton                 = COALESCE(EXCLUDED.ton, mybotia_business.clients.ton),
             dolibarr_societe_id = COALESCE(EXCLUDED.dolibarr_societe_id, mybotia_business.clients.dolibarr_societe_id),
             town                = COALESCE(EXCLUDED.town, mybotia_business.clients.town),
             country_code        = COALESCE(EXCLUDED.country_code, mybotia_business.clients.country_code),
             updated_at          = NOW()
           RETURNING id, xmax::text`,
          [
            TENANT_ID,
            record.name,
            record.email,
            record.phone,
            record.client_type,
            record.status,
            record.ton,
            record.lea_slug,
            record.dolibarr_societe_id,
            record.dolibarr_town,
            record.dolibarr_country_code,
            record.parse_error ? `[import-p0] parse_error: ${record.parse_error}` : null,
          ]
        );

        const row = upsertRes.rows[0];
        if (!row) throw new Error("No row returned from upsert");

        const clientId = row.id;
        const wasUpdate = row.xmax !== "0";
        clientSlugToId.set(record.lea_slug, clientId);

        if (wasUpdate) {
          result.updated_clients++;
        } else {
          result.inserted_clients++;
        }

        // ── Upsert primary contact ────────────────────────────────────────
        if (record.contact_name) {
          // Look for Dolibarr enrichment
          let contactEmail = record.email;
          let contactPhone = record.phone;
          if (record.dolibarr_societe_id) {
            const doliContact = doliContacts.find(
              (c) => c.fk_soc === record.dolibarr_societe_id
            );
            if (doliContact) {
              contactEmail = doliContact.email || contactEmail;
              contactPhone = doliContact.phone || contactPhone;
            }
          }

          await pg.query(
            `INSERT INTO mybotia_business.contacts
               (tenant_id, client_id, name, email, phone, role, is_primary, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'principal', TRUE, NOW())
             ON CONFLICT DO NOTHING`,
            [TENANT_ID, clientId, record.contact_name, contactEmail, contactPhone]
          );
          result.inserted_contacts++;
        }

        // ── Upsert JIDs ───────────────────────────────────────────────────
        for (let i = 0; i < record.jids.length; i++) {
          const { jid, group_name } = record.jids[i];
          const isPrimary = i === 0;
          try {
            const jidRes = await pg.query(
              `INSERT INTO mybotia_business.client_jids
                 (tenant_id, client_id, jid, group_name, is_primary)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (tenant_id, client_id, jid) DO NOTHING
               RETURNING id`,
              [TENANT_ID, clientId, jid, group_name, isPrimary]
            );
            if (jidRes.rowCount && jidRes.rowCount > 0) {
              result.inserted_jids++;
            }
          } catch (jidErr: unknown) {
            const msg = jidErr instanceof Error ? jidErr.message : String(jidErr);
            warn(`JID insert failed for ${record.lea_slug} jid=${jid}: ${msg}`);
            result.conflicts.push(`JID conflict: ${record.lea_slug}/${jid}`);
          }
        }
      } catch (recordErr: unknown) {
        const msg =
          recordErr instanceof Error ? recordErr.message : String(recordErr);
        err(`Failed to import client ${record.lea_slug}: ${msg}`);
        result.conflicts.push(`Client import failed: ${record.lea_slug} — ${msg}`);
      }
    }

    // ── Step 2: Dolibarr-only clients ────────────────────────────────────────
    for (const rowid of DOLIBARR_ONLY_ROWIDS) {
      const societe = doliSocietes.find((s) => s.rowid === rowid);
      if (!societe) continue;

      try {
        const clientType = "b2b";
        const upsertRes = await pg.query<{ id: string; xmax: string }>(
          `INSERT INTO mybotia_business.clients
             (tenant_id, name, email, phone, client_type, status, dolibarr_societe_id,
              town, country_code, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, 'FR', NOW())
           ON CONFLICT DO NOTHING
           RETURNING id, xmax::text`,
          [
            TENANT_ID,
            societe.nom,
            societe.email,
            societe.phone,
            clientType,
            societe.rowid,
            societe.town,
          ]
        );

        if (upsertRes.rows.length > 0) {
          const clientId = upsertRes.rows[0].id;
          const wasUpdate = upsertRes.rows[0].xmax !== "0";
          if (wasUpdate) result.updated_clients++;
          else result.inserted_clients++;

          // Primary contact from llx_socpeople
          const doliContact = doliContacts.find((c) => c.fk_soc === rowid);
          if (doliContact) {
            const contactName =
              [doliContact.firstname, doliContact.lastname]
                .filter(Boolean)
                .join(" ") || societe.nom;
            await pg.query(
              `INSERT INTO mybotia_business.contacts
                 (tenant_id, client_id, name, email, phone, role, is_primary, updated_at)
               VALUES ($1, $2, $3, $4, $5, 'principal', TRUE, NOW())
               ON CONFLICT DO NOTHING`,
              [
                TENANT_ID,
                clientId,
                contactName,
                doliContact.email,
                doliContact.phone,
              ]
            );
            result.inserted_contacts++;
          }
        } else {
          // Row already existed, count as update
          result.updated_clients++;
        }
      } catch (doliErr: unknown) {
        const msg = doliErr instanceof Error ? doliErr.message : String(doliErr);
        err(`Failed to import dolibarr-only client rowid=${rowid}: ${msg}`);
        result.conflicts.push(
          `Dolibarr-only import failed: rowid=${rowid} — ${msg}`
        );
      }
    }

    // ── Step 3: Tasks via sentinel project ───────────────────────────────────
    // Create or reuse a sentinel project "_PENDING_TASKS_P0" linked to Gilles client
    const gillesClientId = clientSlugToId.get("gilles");
    if (!gillesClientId) {
      warn(
        "Gilles client not found after upsert — tasks will be linked to first available client"
      );
    }

    // Find or create the sentinel project
    let sentinelProjectId: string;
    const sentinelRes = await pg.query<{ id: string }>(
      `SELECT id FROM mybotia_business.projects
       WHERE tenant_id = $1 AND name = '_PENDING_TASKS_P0'
       LIMIT 1`,
      [TENANT_ID]
    );

    if (sentinelRes.rows.length > 0) {
      sentinelProjectId = sentinelRes.rows[0].id;
      log(`Reusing sentinel project id=${sentinelProjectId}`);
    } else {
      // Need a valid client_id for the project — use Gilles or first workspace client
      let anchorClientId = gillesClientId;
      if (!anchorClientId) {
        const firstClient = await pg.query<{ id: string }>(
          `SELECT id FROM mybotia_business.clients WHERE tenant_id=$1 LIMIT 1`,
          [TENANT_ID]
        );
        anchorClientId = firstClient.rows[0]?.id;
      }

      if (!anchorClientId) {
        throw new Error(
          "No client available to anchor sentinel project for tasks"
        );
      }

      const projRes = await pg.query<{ id: string }>(
        `INSERT INTO mybotia_business.projects
           (tenant_id, client_id, name, description, status, lifecycle_stage)
         VALUES ($1, $2, '_PENDING_TASKS_P0', 'Sentinel project pour import tâches PENDING (import P0)', 'active', 'affaire')
         RETURNING id`,
        [TENANT_ID, anchorClientId]
      );
      sentinelProjectId = projRes.rows[0].id;
      log(`Created sentinel project id=${sentinelProjectId}`);
    }

    result.sentinel_project_id = sentinelProjectId;

    // Insert tasks
    for (const task of tasks) {
      // Resolve client project if possible
      let taskProjectId = sentinelProjectId;

      if (task.lea_slug_hint) {
        const clientId = clientSlugToId.get(task.lea_slug_hint);
        if (clientId) {
          // Try to find existing project for this client, or use sentinel
          const projRes = await pg.query<{ id: string }>(
            `SELECT id FROM mybotia_business.projects
             WHERE tenant_id=$1 AND client_id=$2
             ORDER BY created_at LIMIT 1`,
            [TENANT_ID, clientId]
          );
          if (projRes.rows.length > 0) {
            taskProjectId = projRes.rows[0].id;
          }
        }
      }

      try {
        const insertRes = await pg.query(
          `INSERT INTO mybotia_business.tasks
             (tenant_id, project_id, title, description, status, due_date, category, updated_at)
           VALUES ($1, $2, $3, $4, 'todo', $5::date, 'pending_import', NOW())
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [
            TENANT_ID,
            taskProjectId,
            `[P0] ${task.client_label} — ${task.description.substring(0, 100)}`,
            task.description,
            task.due_date,
          ]
        );
        if (insertRes.rowCount && insertRes.rowCount > 0) {
          result.inserted_tasks++;
        }
      } catch (taskErr: unknown) {
        const msg = taskErr instanceof Error ? taskErr.message : String(taskErr);
        warn(`Task insert failed for "${task.client_label}": ${msg}`);
        result.conflicts.push(`Task conflict: ${task.client_label} — ${msg}`);
      }
    }

    // ── Step 4: Audit log ─────────────────────────────────────────────────────
    const auditDiff = {
      action: "IMPORT_P0",
      script: "v11i-a-p0-import.ts",
      timestamp: new Date().toISOString(),
      counts: {
        clients_inserted: result.inserted_clients,
        clients_updated: result.updated_clients,
        contacts_inserted: result.inserted_contacts,
        jids_inserted: result.inserted_jids,
        tasks_inserted: result.inserted_tasks,
      },
      conflicts: result.conflicts,
      sentinel_project_id: sentinelProjectId,
    };

    await pg.query(
      `INSERT INTO mybotia_business.audit_logs
         (tenant_id, table_name, row_id, action, diff)
       VALUES ($1, 'import_p0', 'bulk', 'IMPORT_P0', $2::jsonb)`,
      [TENANT_ID, JSON.stringify(auditDiff)]
    );

    await pg.query("COMMIT");
    log("Transaction COMMIT — import P0 applied successfully.");
  } catch (e: unknown) {
    await pg.query("ROLLBACK");
    const msg = e instanceof Error ? e.message : String(e);
    err(`ROLLBACK triggered: ${msg}`);
    throw e;
  }

  return result;
}

// ─── Report helpers ───────────────────────────────────────────────────────────

function printDryRunReport(dryRun: DryRunResult) {
  console.log("\n" + "═".repeat(72));
  console.log("  V1.1.I-A — Phase 2C — DRY-RUN REPORT");
  console.log("═".repeat(72));
  console.log(`  Tenant : mybotia (${TENANT_ID})`);
  console.log(`  Mode   : DRY-RUN (--apply not passed)`);
  console.log("─".repeat(72));

  console.log("\n## CLIENTS WORKSPACE LÉA\n");
  console.log(
    `${"SLUG".padEnd(22)} ${"ACTION".padEnd(8)} ${"STATUS".padEnd(10)} ${"EMAIL".padEnd(32)} NOTE`
  );
  console.log("─".repeat(100));

  for (const { record, action, existing_id, conflict_reason } of dryRun.clients) {
    const note = record.parse_error
      ? `PARSE_ERR: ${record.parse_error.substring(0, 40)}`
      : existing_id
      ? `existing_id=${existing_id.substring(0, 8)}...`
      : "";
    const conflictNote = conflict_reason ? ` | CONFLICT: ${conflict_reason}` : "";
    console.log(
      `${record.lea_slug.padEnd(22)} ${action.padEnd(8)} ${record.status.padEnd(10)} ${(record.email || "").padEnd(32)} ${note}${conflictNote}`
    );
  }

  console.log("\n## CLIENTS DOLIBARR-ONLY\n");
  console.log(
    `${"NOM".padEnd(35)} ${"ROWID".padEnd(8)} ${"ACTION".padEnd(8)} NOTE`
  );
  console.log("─".repeat(72));
  for (const { societe, action, existing_id } of dryRun.dolibarr_only) {
    const note = existing_id ? `existing_id=${existing_id.substring(0, 8)}...` : "";
    console.log(
      `${societe.nom.padEnd(35)} ${String(societe.rowid).padEnd(8)} ${action.padEnd(8)} ${note}`
    );
  }

  console.log("\n## TÂCHES PENDING\n");
  for (const task of dryRun.tasks) {
    const slugInfo = task.lea_slug_hint ? `→ ${task.lea_slug_hint}` : "→ [no slug match]";
    console.log(
      `  ${task.due_date}  ${(task.client_label + ":").padEnd(30)} ${slugInfo}`
    );
    console.log(`    ${task.description.substring(0, 90)}`);
  }

  if (dryRun.parse_errors.length > 0) {
    console.log("\n## ERREURS DE PARSING\n");
    for (const { slug, error } of dryRun.parse_errors) {
      console.log(`  [ERROR] ${slug}: ${error}`);
    }
  }

  console.log("\n## SUMMARY\n");
  const c = dryRun.counts;
  console.log(`  Clients CREATE         : ${c.clients_create}`);
  console.log(`  Clients UPDATE         : ${c.clients_update}`);
  console.log(`  Clients SKIP           : ${c.clients_skip}`);
  console.log(`  Contacts               : ${c.contacts}`);
  console.log(`  JIDs                   : ${c.jids}`);
  console.log(`  Tasks                  : ${c.tasks}`);
  console.log(`  Parse errors           : ${dryRun.parse_errors.length}`);
  console.log(
    `\n  Total rows estimés     : ${c.clients_create + c.clients_update} clients, ${c.contacts} contacts, ${c.jids} jids, ${c.tasks} tasks`
  );
  console.log("═".repeat(72));
  console.log(
    "\n  VERDICT : Dry-run terminé. Relancer avec --apply pour appliquer.\n"
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(`=== V1.1.I-A P0 Import — mode: ${APPLY ? "APPLY" : "DRY-RUN"} ===`);

  // 1. Load Dolibarr data
  const doliSocietes = loadDolibarrSocietes();
  const doliContacts = loadDolibarrContacts();
  log(`Dolibarr: ${doliSocietes.length} societes, ${doliContacts.length} contacts`);

  // 2. Load JID index
  const jidIndex = loadJidIndex();
  log(`JID index: ${Object.keys(jidIndex).length} entries`);

  // 3. Load workspace clients
  const { records: workspaceRecords, errors: parseErrors } =
    loadWorkspaceClients(jidIndex, doliSocietes);
  log(`Workspace: ${workspaceRecords.length} clients parsed, ${parseErrors.length} errors`);

  // 4. Load pending tasks
  let tasks: PendingTask[] = [];
  if (fs.existsSync(PENDING_TASKS_PATH)) {
    const content = fs.readFileSync(PENDING_TASKS_PATH, "utf-8");
    tasks = parsePendingTasks(content);
    log(`Tasks: ${tasks.length} PENDING tasks found`);
  } else {
    warn("PENDING_TASKS.md not found, skipping tasks");
  }

  // 5. Connect to Postgres
  const pg = await makePgClient();
  log("Postgres connected to mybotia_core");

  try {
    if (!APPLY) {
      const dryRun = await runDryRun(
        workspaceRecords,
        doliSocietes,
        tasks,
        parseErrors,
        pg
      );
      printDryRunReport(dryRun);
    } else {
      log("Starting APPLY — transaction BEGIN...");
      const applyResult = await runApply(
        workspaceRecords,
        doliSocietes,
        doliContacts,
        tasks,
        pg
      );

      console.log("\n" + "═".repeat(72));
      console.log("  V1.1.I-A — Phase 2C — APPLY RESULT");
      console.log("═".repeat(72));
      console.log(`  Clients inserted : ${applyResult.inserted_clients}`);
      console.log(`  Clients updated  : ${applyResult.updated_clients}`);
      console.log(`  Contacts         : ${applyResult.inserted_contacts}`);
      console.log(`  JIDs             : ${applyResult.inserted_jids}`);
      console.log(`  Tasks            : ${applyResult.inserted_tasks}`);
      console.log(`  Sentinel project : ${applyResult.sentinel_project_id}`);
      if (applyResult.conflicts.length > 0) {
        console.log(`\n  CONFLICTS (${applyResult.conflicts.length}):`);
        for (const c of applyResult.conflicts) {
          console.log(`    - ${c}`);
        }
      }
      console.log("\n  Audit log IMPORT_P0 inscrit en DB.");
      console.log("═".repeat(72));
    }
  } finally {
    await pg.end();
  }
}

main().catch((e) => {
  err(`Fatal: ${e instanceof Error ? e.message : String(e)}`);
  if (e instanceof Error && e.stack) err(e.stack);
  process.exit(1);
});
