// UB-4 — API admin globale Usage & Billing.
//
// Doctrine :
//   - Superadmin only via requireSuperadmin() (post SEC-1).
//   - Lecture seule : core.tenant + core.subscriptions + billing.ai_usage_monthly_summary
//                     + billing.ai_recharges.
//   - Vue business : EUR uniquement. Pas de provider/model/Anthropic/Claude/Sonnet/Opus
//     même côté admin. L'audit technique modèle reste ailleurs.
//   - 1 item = 1 couple (tenant_slug, agent_slug). Plusieurs agents par tenant supportés.
//   - Tenants sans sub active mais avec usage → status="not_configured" (visible).
//   - Tenants sans sub ni usage ni recharge → omis (évite pollution).

import { requireSuperadmin } from "@/lib/admin-auth";
import { adminQuery } from "@/lib/admin-db";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

type AlertState =
  | "ok"
  | "soft_limit"
  | "high_usage"
  | "hard_limit"
  | "not_configured";

type ServiceTierKey = "standard" | "premium" | "background" | "system";

const TIER_LABEL: Record<ServiceTierKey, string> = {
  standard: "Standard",
  premium: "Premium",
  background: "Standard",
  system: "Standard",
};

function normalizeTier(raw: string | null): ServiceTierKey {
  if (!raw) return "standard";
  const v = raw.toLowerCase().trim();
  if (v === "premium") return "premium";
  if (v === "background") return "background";
  if (v === "system") return "system";
  return "standard";
}

function monthBounds(now: Date) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const from = new Date(Date.UTC(y, m, 1));
  const to = new Date(Date.UTC(y, m + 1, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const monthIso = `${y}-${String(m + 1).padStart(2, "0")}`;
  return { month: monthIso, from: iso(from), to: iso(to) };
}

function pickAlertState(
  usagePercent: number,
  soft: number,
  hard: number,
  configured: boolean
): AlertState {
  if (!configured) return "not_configured";
  if (usagePercent >= hard) return "hard_limit";
  if (usagePercent >= 90) return "high_usage";
  if (usagePercent >= soft) return "soft_limit";
  return "ok";
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: string | number | null) => (v === null ? 0 : Number(v));

type TenantRow = {
  id: string;
  slug: string;
  display_name: string;
};

type SubRow = {
  tenant_id: string;
  ai_budget_monthly_eur: string | null;
  ai_markup_rate: string | null;
  soft_limit_percent: number | null;
  hard_limit_percent: number | null;
  recharge_enabled: boolean | null;
  business_plan_code: string | null;
  business_plan_label: string | null;
  category: string;
};

type UsageRow = {
  tenant_id: string;
  agent_slug: string;
  service_tier: string | null;
  api_eur: string | null;
  client_eur: string | null;
};

type RechargeRow = {
  tenant_id: string;
  recharges_eur: string | null;
};

export async function GET() {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }

  const period = monthBounds(new Date());

  // 1) Subs ai_collaborator actives (1 par tenant, plus récente)
  const subRows = await adminQuery<SubRow>(
    `SELECT DISTINCT ON (s.tenant_id)
            s.tenant_id,
            s.ai_budget_monthly_eur,
            s.ai_markup_rate,
            s.soft_limit_percent,
            s.hard_limit_percent,
            s.recharge_enabled,
            s.business_plan_code,
            s.business_plan_label,
            s.category
       FROM core.subscriptions s
      WHERE s.category = 'ai_collaborator' AND s.status = 'active'
      ORDER BY s.tenant_id, s.created_at DESC`
  );
  const subByTenant = new Map<string, SubRow>(subRows.map((r) => [r.tenant_id, r]));

  // 2) Usage du mois agrégé (tenant_id, agent_slug, service_tier)
  const usageRows = await adminQuery<UsageRow>(
    `SELECT v.tenant_id,
            v.agent_slug,
            v.service_tier,
            v.api_cost_estimated    AS api_eur,
            v.client_cost_estimated AS client_eur
       FROM billing.ai_usage_monthly_summary v
      WHERE v.month = date_trunc('month', $1::date)::date
        AND v.tenant_id IS NOT NULL`,
    [period.from]
  );

  // 3) Recharges actives du mois
  const rechargeRows = await adminQuery<RechargeRow>(
    `SELECT tenant_id, SUM(amount_ht)::numeric AS recharges_eur
       FROM billing.ai_recharges
      WHERE payment_status IN ('paid','succeeded','completed')
        AND tenant_id IS NOT NULL
        AND valid_from <= now()
        AND (valid_until IS NULL OR valid_until >= now())
      GROUP BY tenant_id`
  );
  const rechargeByTenant = new Map<string, number>(
    rechargeRows.map((r) => [r.tenant_id, num(r.recharges_eur)])
  );

  // 4) Tenants pertinents = ceux ayant sub OU usage OU recharge
  const tenantIds = new Set<string>();
  for (const s of subRows) tenantIds.add(s.tenant_id);
  for (const u of usageRows) tenantIds.add(u.tenant_id);
  for (const r of rechargeRows) tenantIds.add(r.tenant_id);

  const tenantRows = tenantIds.size
    ? await adminQuery<TenantRow>(
        `SELECT id, slug, display_name FROM core.tenant WHERE id = ANY($1::uuid[])`,
        [Array.from(tenantIds)]
      )
    : [];
  const tenantById = new Map<string, TenantRow>(tenantRows.map((t) => [t.id, t]));

  // 5) Pivot par (tenant_id, agent_slug) avec breakdown service_tier
  type ItemKey = string;
  type ItemAgg = {
    tenant_id: string;
    agent_slug: string;
    tiers: Map<ServiceTierKey, { api: number; client: number }>;
    totalApi: number;
    totalClient: number;
  };
  const items = new Map<ItemKey, ItemAgg>();

  for (const u of usageRows) {
    const tier = normalizeTier(u.service_tier);
    const api = num(u.api_eur);
    const client = num(u.client_eur);
    const key = `${u.tenant_id}::${u.agent_slug}`;
    let it = items.get(key);
    if (!it) {
      it = {
        tenant_id: u.tenant_id,
        agent_slug: u.agent_slug,
        tiers: new Map(),
        totalApi: 0,
        totalClient: 0,
      };
      items.set(key, it);
    }
    const t = it.tiers.get(tier) ?? { api: 0, client: 0 };
    t.api += api;
    t.client += client;
    it.tiers.set(tier, t);
    it.totalApi += api;
    it.totalClient += client;
  }

  // Tenants avec sub mais sans usage → 1 item agent_slug=null
  for (const sub of subRows) {
    const hasItem = Array.from(items.values()).some((i) => i.tenant_id === sub.tenant_id);
    if (!hasItem) {
      const key = `${sub.tenant_id}::__none__`;
      items.set(key, {
        tenant_id: sub.tenant_id,
        agent_slug: "",
        tiers: new Map(),
        totalApi: 0,
        totalClient: 0,
      });
    }
  }

  // 6) Construction items + summary
  const tierVisOrder: ServiceTierKey[] = ["standard", "premium"];
  let summaryBudget = 0;
  let summaryClient = 0;
  let summaryApi = 0;
  let summaryRecharges = 0;
  const configuredTenants = new Set<string>();
  const notConfiguredTenants = new Set<string>();
  const allTenants = new Set<string>();

  const responseItems = Array.from(items.values()).map((it) => {
    const tenant = tenantById.get(it.tenant_id);
    const sub = subByTenant.get(it.tenant_id);
    const recharges = rechargeByTenant.get(it.tenant_id) ?? 0;
    const slug = tenant?.slug ?? "unknown";
    const label = tenant?.display_name ?? slug;
    allTenants.add(slug);

    const configured = !!sub && sub.ai_budget_monthly_eur !== null;
    if (configured) configuredTenants.add(slug);
    else notConfiguredTenants.add(slug);

    const monthlyEur = configured ? num(sub.ai_budget_monthly_eur) : 0;
    const consumedClient = round2(it.totalClient);
    const consumedApi = round2(it.totalApi);
    const totalAvail = monthlyEur + recharges;
    const usagePercent = totalAvail > 0 ? round2((consumedClient / totalAvail) * 100) : 0;
    const remaining = round2(totalAvail - consumedClient);
    const marginEur = round2(consumedClient - consumedApi);
    const marginPct =
      consumedClient > 0 ? round2((marginEur / consumedClient) * 100) : null;

    const soft = sub?.soft_limit_percent ?? 70;
    const hard = sub?.hard_limit_percent ?? 100;
    const alertState = pickAlertState(usagePercent, soft, hard, configured);

    const serviceTiers = tierVisOrder
      .filter((t) => it.tiers.has(t))
      .map((t) => {
        const v = it.tiers.get(t)!;
        return {
          tier: t,
          label: TIER_LABEL[t],
          consumed_client_eur: round2(v.client),
          consumed_api_eur: round2(v.api),
        };
      });

    // Summary aggregation (budget compté 1× par tenant via sub)
    summaryClient += consumedClient;
    summaryApi += consumedApi;

    return {
      tenant_slug: slug,
      tenant_label: label,
      agent_slug: it.agent_slug || null,
      plan: {
        code: sub?.business_plan_code ?? (configured ? "custom" : null),
        label: sub?.business_plan_label ?? (configured ? "Plan personnalisé" : null),
        category: sub?.category ?? null,
      },
      budget: {
        monthly_eur: round2(monthlyEur),
        consumed_client_eur: consumedClient,
        consumed_api_eur: consumedApi,
        remaining_eur: remaining,
        usage_percent: usagePercent,
        recharges_eur: round2(recharges),
      },
      margin: {
        eur: marginEur,
        percent: marginPct,
      },
      limits: {
        soft_limit_percent: soft,
        hard_limit_percent: hard,
        recharge_enabled: sub?.recharge_enabled ?? true,
      },
      alert_state: alertState,
      service_tiers: serviceTiers,
    };
  });

  for (const sub of subRows) {
    const t = tenantById.get(sub.tenant_id);
    if (!t) continue;
    summaryBudget += num(sub.ai_budget_monthly_eur);
  }
  for (const [tenantId, eur] of rechargeByTenant) {
    if (tenantById.has(tenantId)) summaryRecharges += eur;
  }

  return Response.json(
    {
      status: "ok",
      period,
      summary: {
        tenants_count: allTenants.size,
        configured_count: configuredTenants.size,
        not_configured_count: notConfiguredTenants.size,
        budget_total_eur: round2(summaryBudget),
        consumed_client_eur: round2(summaryClient),
        consumed_api_eur: round2(summaryApi),
        margin_eur: round2(summaryClient - summaryApi),
        recharges_eur: round2(summaryRecharges),
      },
      items: responseItems,
    },
    { headers: NO_STORE }
  );
}
