// UB-3 — API client euro-first : consommation IA du tenant courant.
//
// Doctrine :
//   - Tenant déterminé par hostname (resolveCockpitTenant) — autorité serveur.
//   - Source budget : core.subscriptions.category = 'ai_collaborator' (1 ligne active).
//   - Source consommation : billing.ai_usage_monthly_summary (vue UB-2, markup × 1.20 fallback).
//   - Réponse JSON volontairement euro-only :
//       interdits → provider, model, tokens_*, api_cost, estimated_cost,
//                   noms de modèles (Claude/Sonnet/Opus/Anthropic/GPT/...).
//   - Si aucune ligne ai_collaborator active → status='not_configured', pas une erreur.
//
// Routes voisines inchangées : /api/me/usage/tokens, /api/admin/usage/tokens.

import { getSession } from "@/lib/session";
import { resolveCockpitTenant } from "@/lib/tenant-resolver";
import { adminQuery } from "@/lib/admin-db";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

type SubscriptionRow = {
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
  service_tier: string | null;
  client_cost_estimated: string | null;
};

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

function monthBounds(now: Date): { month: string; from: string; to: string } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const from = new Date(Date.UTC(y, m, 1));
  const to = new Date(Date.UTC(y, m + 1, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const monthIso = `${y}-${String(m + 1).padStart(2, "0")}`;
  return { month: monthIso, from: iso(from), to: iso(to) };
}

function buildAlerts(usagePercent: number, soft: number, hard: number): string[] {
  const out: string[] = [];
  if (usagePercent >= soft) out.push("soft_limit");
  if (usagePercent >= 90) out.push("high_usage");
  if (usagePercent >= hard) out.push("hard_limit");
  return out;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json(
      { error: "Non authentifie" },
      { status: 401, headers: NO_STORE }
    );
  }

  const cockpit = resolveCockpitTenant(request);
  if (!session.isSuperadmin && cockpit.slug !== session.tenantSlug) {
    return Response.json(
      { error: "tenant_slug non autorise pour cet utilisateur" },
      { status: 403, headers: NO_STORE }
    );
  }

  const tenantSlug = cockpit.slug;
  const period = monthBounds(new Date());

  const subRows = await adminQuery<SubscriptionRow>(
    `SELECT s.ai_budget_monthly_eur,
            s.ai_markup_rate,
            s.soft_limit_percent,
            s.hard_limit_percent,
            s.recharge_enabled,
            s.business_plan_code,
            s.business_plan_label,
            s.category
       FROM core.subscriptions s
       JOIN core.tenant t ON t.id = s.tenant_id
      WHERE t.slug = $1
        AND s.category = 'ai_collaborator'
        AND s.status = 'active'
      ORDER BY s.created_at DESC
      LIMIT 1`,
    [tenantSlug]
  );

  const sub = subRows[0];

  if (!sub || sub.ai_budget_monthly_eur === null) {
    return Response.json(
      {
        status: "not_configured",
        tenant_slug: tenantSlug,
        message: "Budget IA non configuré pour ce tenant.",
        period,
        budget: {
          monthly_eur: 0,
          consumed_eur: 0,
          remaining_eur: 0,
          usage_percent: 0,
        },
        alerts: [],
      },
      { headers: NO_STORE }
    );
  }

  const usageRows = await adminQuery<UsageRow>(
    `SELECT v.service_tier, v.client_cost_estimated
       FROM billing.ai_usage_monthly_summary v
       JOIN core.tenant t ON t.id = v.tenant_id
      WHERE t.slug = $1
        AND v.month = date_trunc('month', $2::date)::date`,
    [tenantSlug, period.from]
  );

  const tierTotals = new Map<ServiceTierKey, number>();
  let consumedTotal = 0;
  for (const r of usageRows) {
    const tier = normalizeTier(r.service_tier);
    const cost = r.client_cost_estimated === null ? 0 : Number(r.client_cost_estimated);
    consumedTotal += cost;
    tierTotals.set(tier, (tierTotals.get(tier) ?? 0) + cost);
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const monthlyEur = Number(sub.ai_budget_monthly_eur);
  const consumedEur = round2(consumedTotal);
  const remainingEur = round2(monthlyEur - consumedEur);
  const usagePercent =
    monthlyEur > 0 ? round2((consumedEur / monthlyEur) * 100) : 0;

  const soft = sub.soft_limit_percent ?? 70;
  const hard = sub.hard_limit_percent ?? 100;

  const tierVisibilityOrder: ServiceTierKey[] = ["standard", "premium"];
  const serviceTiers = tierVisibilityOrder
    .filter((t) => tierTotals.has(t))
    .map((t) => ({
      tier: t,
      label: TIER_LABEL[t],
      consumed_eur: round2(tierTotals.get(t) ?? 0),
    }));

  return Response.json(
    {
      status: "ok",
      tenant_slug: tenantSlug,
      period,
      plan: {
        code: sub.business_plan_code ?? "custom",
        label: sub.business_plan_label ?? "Plan personnalisé",
        category: sub.category,
      },
      budget: {
        monthly_eur: round2(monthlyEur),
        consumed_eur: consumedEur,
        remaining_eur: remainingEur,
        usage_percent: usagePercent,
      },
      limits: {
        soft_limit_percent: soft,
        hard_limit_percent: hard,
        recharge_enabled: sub.recharge_enabled ?? true,
      },
      service_tiers: serviceTiers,
      alerts: buildAlerts(usagePercent, soft, hard),
    },
    { headers: NO_STORE }
  );
}
