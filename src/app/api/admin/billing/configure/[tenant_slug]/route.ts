// UB-9 — Configuration plan/budget IA d'un tenant (superadmin only).
//
// Doctrine :
//   - Une seule subscription category='ai_collaborator' status='active' par tenant.
//   - PUT idempotent : crée si absente, met à jour sinon, dans une seule transaction.
//   - Si plusieurs lignes active existent (anomalie), on refuse et on rapporte.
//   - PUT ne touche jamais aux subs des autres catégories.
//   - GET retourne l'état actuel (sub active + tenant info).

import { adminQuery, adminTx } from "@/lib/admin-db";
import { requireSuperadmin } from "@/lib/admin-auth";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

const BUDGET_MODES = ["fixed_budget", "per_establishment", "custom"] as const;
const PLAN_CODES = ["solo", "equipe", "service", "per_establishment", "custom"] as const;
const STATUSES_ALLOWED = ["active", "paused", "cancelled"] as const;

type BudgetMode = (typeof BUDGET_MODES)[number];
type PlanCode = (typeof PLAN_CODES)[number];
type ConfigStatus = (typeof STATUSES_ALLOWED)[number];

interface ConfigRow {
  id: string;
  tenant_id: string;
  tenant_slug: string;
  tenant_label: string;
  client_name: string;
  label: string;
  category: string;
  status: string;
  monthly_amount: string;
  currency: string;
  ai_budget_monthly_eur: string | null;
  ai_budget_mode: string | null;
  ai_markup_rate: string | null;
  budget_per_establishment_eur: string | null;
  establishment_count: number | null;
  soft_limit_percent: number | null;
  hard_limit_percent: number | null;
  recharge_enabled: boolean | null;
  business_plan_code: string | null;
  business_plan_label: string | null;
}

function toResp(r: ConfigRow) {
  const num = (v: string | null) => (v === null ? null : Number(v));
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    tenant_slug: r.tenant_slug,
    tenant_label: r.tenant_label,
    client_name: r.client_name,
    label: r.label,
    category: r.category,
    status: r.status,
    monthly_amount: num(r.monthly_amount),
    currency: r.currency,
    ai_budget_monthly_eur: num(r.ai_budget_monthly_eur),
    ai_budget_mode: r.ai_budget_mode,
    ai_markup_rate: num(r.ai_markup_rate),
    budget_per_establishment_eur: num(r.budget_per_establishment_eur),
    establishment_count: r.establishment_count,
    soft_limit_percent: r.soft_limit_percent,
    hard_limit_percent: r.hard_limit_percent,
    recharge_enabled: r.recharge_enabled,
    business_plan_code: r.business_plan_code,
    business_plan_label: r.business_plan_label,
  };
}

const SELECT_CONFIG = `
  s.id, s.tenant_id, t.slug AS tenant_slug, t.display_name AS tenant_label,
  s.client_name, s.label, s.category, s.status,
  s.monthly_amount, s.currency,
  s.ai_budget_monthly_eur, s.ai_budget_mode, s.ai_markup_rate,
  s.budget_per_establishment_eur, s.establishment_count,
  s.soft_limit_percent, s.hard_limit_percent, s.recharge_enabled,
  s.business_plan_code, s.business_plan_label
`;

// --- GET ---------------------------------------------------------------------

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenant_slug: string }> }
) {
  const auth = await requireSuperadmin();
  if (!auth.ok)
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });

  const { tenant_slug } = await params;
  if (!tenant_slug || !/^[a-z0-9_-]+$/i.test(tenant_slug))
    return Response.json({ error: "tenant_slug invalide" }, { status: 400, headers: NO_STORE });

  const tenants = await adminQuery<{ id: string; slug: string; display_name: string }>(
    `SELECT id, slug, display_name FROM core.tenant WHERE slug = $1`,
    [tenant_slug]
  );
  if (!tenants[0])
    return Response.json({ error: "tenant inconnu" }, { status: 404, headers: NO_STORE });

  const rows = await adminQuery<ConfigRow>(
    `SELECT ${SELECT_CONFIG}
       FROM core.subscriptions s
       JOIN core.tenant t ON t.id = s.tenant_id
      WHERE t.slug = $1
        AND s.category = 'ai_collaborator'
        AND s.status = 'active'
      ORDER BY s.created_at DESC`,
    [tenant_slug]
  );

  if (rows.length > 1) {
    return Response.json(
      {
        status: "anomaly_multiple_active",
        message:
          "Plusieurs subscriptions ai_collaborator actives pour ce tenant. Cleanup manuel requis.",
        tenant: tenants[0],
        active_count: rows.length,
      },
      { status: 409, headers: NO_STORE }
    );
  }

  return Response.json(
    {
      status: rows[0] ? "configured" : "not_configured",
      tenant: tenants[0],
      config: rows[0] ? toResp(rows[0]) : null,
    },
    { headers: NO_STORE }
  );
}

// --- PUT ---------------------------------------------------------------------

interface ConfigBody {
  business_plan_code: PlanCode;
  business_plan_label: string;
  ai_budget_mode: BudgetMode;
  ai_budget_monthly_eur: number;
  budget_per_establishment_eur?: number | null;
  establishment_count?: number | null;
  ai_markup_rate?: number;
  soft_limit_percent?: number;
  hard_limit_percent?: number;
  recharge_enabled?: boolean;
  status?: ConfigStatus;
}

function validateBody(b: unknown): { ok: true; data: ConfigBody } | { ok: false; error: string } {
  if (!b || typeof b !== "object") return { ok: false, error: "body invalide" };
  const o = b as Record<string, unknown>;

  const code = o.business_plan_code;
  if (typeof code !== "string" || !PLAN_CODES.includes(code as PlanCode))
    return { ok: false, error: `business_plan_code invalide (allowed: ${PLAN_CODES.join(", ")})` };

  const label = o.business_plan_label;
  if (typeof label !== "string" || !label.trim())
    return { ok: false, error: "business_plan_label requis" };

  const mode = o.ai_budget_mode;
  if (typeof mode !== "string" || !BUDGET_MODES.includes(mode as BudgetMode))
    return { ok: false, error: `ai_budget_mode invalide (allowed: ${BUDGET_MODES.join(", ")})` };

  const monthlyN = Number(o.ai_budget_monthly_eur);
  if (!Number.isFinite(monthlyN) || monthlyN < 0)
    return { ok: false, error: "ai_budget_monthly_eur doit etre un nombre >= 0" };

  let perEtab: number | null | undefined;
  if (o.budget_per_establishment_eur !== undefined) {
    if (o.budget_per_establishment_eur === null) perEtab = null;
    else {
      const n = Number(o.budget_per_establishment_eur);
      if (!Number.isFinite(n) || n < 0)
        return { ok: false, error: "budget_per_establishment_eur invalide" };
      perEtab = n;
    }
  }

  let estCount: number | null | undefined;
  if (o.establishment_count !== undefined) {
    if (o.establishment_count === null) estCount = null;
    else {
      const n = Number(o.establishment_count);
      if (!Number.isFinite(n) || n < 0)
        return { ok: false, error: "establishment_count invalide" };
      estCount = Math.floor(n);
    }
  }

  let markup: number | undefined;
  if (o.ai_markup_rate !== undefined) {
    const n = Number(o.ai_markup_rate);
    if (!Number.isFinite(n) || n < 0)
      return { ok: false, error: "ai_markup_rate invalide" };
    markup = n;
  }

  let soft: number | undefined;
  if (o.soft_limit_percent !== undefined) {
    const n = Number(o.soft_limit_percent);
    if (!Number.isFinite(n) || n < 0 || n > 1000)
      return { ok: false, error: "soft_limit_percent invalide (0-1000)" };
    soft = Math.floor(n);
  }

  let hard: number | undefined;
  if (o.hard_limit_percent !== undefined) {
    const n = Number(o.hard_limit_percent);
    if (!Number.isFinite(n) || n < 0 || n > 1000)
      return { ok: false, error: "hard_limit_percent invalide (0-1000)" };
    hard = Math.floor(n);
  }

  let recharge: boolean | undefined;
  if (o.recharge_enabled !== undefined) {
    if (typeof o.recharge_enabled !== "boolean")
      return { ok: false, error: "recharge_enabled doit etre boolean" };
    recharge = o.recharge_enabled;
  }

  let status: ConfigStatus | undefined;
  if (o.status !== undefined) {
    if (typeof o.status !== "string" || !STATUSES_ALLOWED.includes(o.status as ConfigStatus))
      return { ok: false, error: `status invalide (allowed: ${STATUSES_ALLOWED.join(", ")})` };
    status = o.status as ConfigStatus;
  }

  return {
    ok: true,
    data: {
      business_plan_code: code as PlanCode,
      business_plan_label: label.trim(),
      ai_budget_mode: mode as BudgetMode,
      ai_budget_monthly_eur: monthlyN,
      budget_per_establishment_eur: perEtab,
      establishment_count: estCount,
      ai_markup_rate: markup,
      soft_limit_percent: soft,
      hard_limit_percent: hard,
      recharge_enabled: recharge,
      status,
    },
  };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tenant_slug: string }> }
) {
  const auth = await requireSuperadmin();
  if (!auth.ok)
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });

  const { tenant_slug } = await params;
  if (!tenant_slug || !/^[a-z0-9_-]+$/i.test(tenant_slug))
    return Response.json({ error: "tenant_slug invalide" }, { status: 400, headers: NO_STORE });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body json invalide" }, { status: 400, headers: NO_STORE });
  }
  const v = validateBody(body);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400, headers: NO_STORE });
  const d = v.data;
  const targetStatus = d.status ?? "active";

  try {
    const result = await adminTx(async (client) => {
      const tres = await client.query<{ id: string; display_name: string }>(
        `SELECT id, display_name FROM core.tenant WHERE slug = $1`,
        [tenant_slug]
      );
      if (!tres.rows[0]) {
        return { error: "tenant inconnu", status: 404 as const };
      }
      const tenant = tres.rows[0];

      const existing = await client.query<{ id: string; created_at: string }>(
        `SELECT id, created_at FROM core.subscriptions
          WHERE tenant_id = $1
            AND category = 'ai_collaborator'
            AND status = 'active'
          ORDER BY created_at DESC
          FOR UPDATE`,
        [tenant.id]
      );

      // Garde-fou anti-double active : si plusieurs lignes existent, refuser.
      if (existing.rowCount && existing.rowCount > 1) {
        return {
          error: `anomalie: ${existing.rowCount} subscriptions ai_collaborator actives pour ce tenant. Cleanup manuel requis.`,
          status: 409 as const,
        };
      }

      // UB-9bis : on aligne aussi label et monthly_amount (champs historiques NOT NULL)
      // sur business_plan_label et ai_budget_monthly_eur pour éviter le drift entre la
      // sub legacy et la conf business V3.
      const fields = [
        ["label", d.business_plan_label],
        ["monthly_amount", d.ai_budget_monthly_eur],
        ["business_plan_code", d.business_plan_code],
        ["business_plan_label", d.business_plan_label],
        ["ai_budget_mode", d.ai_budget_mode],
        ["ai_budget_monthly_eur", d.ai_budget_monthly_eur],
        ["budget_per_establishment_eur", d.budget_per_establishment_eur ?? null],
        ["establishment_count", d.establishment_count ?? null],
        ["ai_markup_rate", d.ai_markup_rate ?? 1.2],
        ["soft_limit_percent", d.soft_limit_percent ?? 70],
        ["hard_limit_percent", d.hard_limit_percent ?? 100],
        ["recharge_enabled", d.recharge_enabled ?? true],
        ["status", targetStatus],
      ] as const;

      let row: ConfigRow;

      if (existing.rows[0]) {
        const id = existing.rows[0].id;
        const sets = fields.map(([k], i) => `${k} = $${i + 1}`).join(", ");
        const args = fields.map(([, val]) => val) as unknown[];
        args.push(id);
        await client.query(
          `UPDATE core.subscriptions SET ${sets} WHERE id = $${args.length}`,
          args
        );
        const after = await client.query<ConfigRow>(
          `SELECT ${SELECT_CONFIG} FROM core.subscriptions s
             JOIN core.tenant t ON t.id = s.tenant_id
            WHERE s.id = $1`,
          [id]
        );
        row = after.rows[0];
      } else {
        // INSERT : remplir aussi les champs NOT NULL existants (client_name, label, monthly_amount, currency, billing_period)
        const insertFields = [
          ["tenant_id", tenant.id],
          ["client_name", tenant.display_name],
          ["label", d.business_plan_label],
          ["category", "ai_collaborator"],
          ["status", targetStatus],
          ["monthly_amount", d.ai_budget_monthly_eur],
          ["currency", "EUR"],
          ["billing_period", "monthly"],
          ...fields.filter(([k]) => k !== "status"),
        ] as const;
        const cols = insertFields.map(([k]) => k).join(", ");
        const placeholders = insertFields.map((_, i) => `$${i + 1}`).join(", ");
        const args = insertFields.map(([, v]) => v);
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO core.subscriptions (${cols}) VALUES (${placeholders}) RETURNING id`,
          args
        );
        const after = await client.query<ConfigRow>(
          `SELECT ${SELECT_CONFIG} FROM core.subscriptions s
             JOIN core.tenant t ON t.id = s.tenant_id
            WHERE s.id = $1`,
          [inserted.rows[0].id]
        );
        row = after.rows[0];
      }

      return { ok: true as const, row };
    });

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    }

    return Response.json(
      { status: "ok", config: toResp(result.row) },
      { headers: NO_STORE }
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}
