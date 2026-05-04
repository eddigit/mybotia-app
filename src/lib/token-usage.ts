// Bloc 6F — calcul KPI tokens partagé entre admin/usage, /me/usage et /finance/kpis.
// Server-only (utilise admin-db).

import { adminQuery } from "./admin-db";

export interface TokenUsageSummary {
  tenant: string;
  displayName: string | null;
  monthIso: string; // "YYYY-MM"
  tokensIncludedMonthly: number | null;
  tokensConsumedMonth: number;
  tokensRemaining: number | null;
  tokensOverage: number;
  estimatedCostMonth: number | null;
  overagePricePer1000Tokens: number | null;
  estimatedOverageAmount: number | null;
  packagesActive: number;
  status: "ready" | "partial" | "to_configure" | "error";
  hasUsage: boolean;
  currency: string;
}

export interface TokenUsageDailyRow {
  date: string;
  agentSlug: string;
  provider: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  estimatedCost: number | null;
  requestCount: number;
}

function currentMonthBounds(): { iso: string; start: string; nextStart: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-11
  const start = new Date(Date.UTC(y, m, 1));
  const nextStart = new Date(Date.UTC(y, m + 1, 1));
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    iso: `${y}-${pad(m + 1)}`,
    start: start.toISOString().slice(0, 10),
    nextStart: nextStart.toISOString().slice(0, 10),
  };
}

interface PackageRow {
  included_monthly_tokens: string | null;
  overage_price_per_1000_tokens: string | null;
  currency: string;
}

interface UsageAgg {
  total_tokens: string | null;
  total_cost: string | null;
}

/**
 * Charge le résumé tokens du mois courant pour un tenant slug.
 * Fait 3 lectures DB :
 *  1. tenant + display_name
 *  2. subs tokens_package actives
 *  3. agrégat token_usage du mois courant
 */
export async function getTokenUsageSummary(slug: string): Promise<TokenUsageSummary> {
  const { iso, start, nextStart } = currentMonthBounds();

  let displayName: string | null = null;
  let tenantId: string | null = null;
  let currency = "EUR";
  try {
    const t = await adminQuery<{ id: string; display_name: string }>(
      "SELECT id, display_name FROM core.tenant WHERE slug = $1",
      [slug]
    );
    if (t[0]) {
      tenantId = t[0].id;
      displayName = t[0].display_name;
    }
  } catch {
    return {
      tenant: slug,
      displayName: null,
      monthIso: iso,
      tokensIncludedMonthly: null,
      tokensConsumedMonth: 0,
      tokensRemaining: null,
      tokensOverage: 0,
      estimatedCostMonth: null,
      overagePricePer1000Tokens: null,
      estimatedOverageAmount: null,
      packagesActive: 0,
      status: "error",
      hasUsage: false,
      currency,
    };
  }

  if (!tenantId) {
    return {
      tenant: slug,
      displayName: null,
      monthIso: iso,
      tokensIncludedMonthly: null,
      tokensConsumedMonth: 0,
      tokensRemaining: null,
      tokensOverage: 0,
      estimatedCostMonth: null,
      overagePricePer1000Tokens: null,
      estimatedOverageAmount: null,
      packagesActive: 0,
      status: "to_configure",
      hasUsage: false,
      currency,
    };
  }

  // Packages tokens actifs
  let packagesActive = 0;
  let tokensIncludedMonthly: number | null = null;
  let overagePricePer1000Tokens: number | null = null;
  try {
    const pkgs = await adminQuery<PackageRow>(
      `SELECT included_monthly_tokens, overage_price_per_1000_tokens, currency
         FROM core.subscriptions
        WHERE tenant_id = $1 AND status = 'active' AND category = 'tokens_package'`,
      [tenantId]
    );
    for (const p of pkgs) {
      packagesActive += 1;
      if (p.included_monthly_tokens != null) {
        tokensIncludedMonthly = (tokensIncludedMonthly ?? 0) + Number(p.included_monthly_tokens);
      }
      if (overagePricePer1000Tokens === null && p.overage_price_per_1000_tokens != null) {
        overagePricePer1000Tokens = parseFloat(p.overage_price_per_1000_tokens);
      }
      if (p.currency) currency = p.currency;
    }
  } catch {
    // packages source error → on continue mais marquera partial
  }

  // Agrégat token_usage du mois courant
  let tokensConsumedMonth = 0;
  let estimatedCostMonth: number | null = null;
  let hasUsage = false;
  try {
    const u = await adminQuery<UsageAgg>(
      `SELECT COALESCE(SUM(tokens_total), 0)::text AS total_tokens,
              SUM(estimated_cost)::text AS total_cost
         FROM core.token_usage
        WHERE tenant_id = $1
          AND usage_date >= $2 AND usage_date < $3`,
      [tenantId, start, nextStart]
    );
    tokensConsumedMonth = Number(u[0]?.total_tokens || 0);
    if (u[0]?.total_cost != null) {
      estimatedCostMonth = parseFloat(u[0].total_cost);
    }
    hasUsage = tokensConsumedMonth > 0;
  } catch {
    // usage source error
    return {
      tenant: slug,
      displayName,
      monthIso: iso,
      tokensIncludedMonthly,
      tokensConsumedMonth: 0,
      tokensRemaining: null,
      tokensOverage: 0,
      estimatedCostMonth: null,
      overagePricePer1000Tokens,
      estimatedOverageAmount: null,
      packagesActive,
      status: "error",
      hasUsage: false,
      currency,
    };
  }

  const tokensRemaining =
    tokensIncludedMonthly !== null
      ? Math.max(tokensIncludedMonthly - tokensConsumedMonth, 0)
      : null;
  const tokensOverage =
    tokensIncludedMonthly !== null
      ? Math.max(tokensConsumedMonth - tokensIncludedMonthly, 0)
      : 0;
  const estimatedOverageAmount =
    tokensOverage > 0 && overagePricePer1000Tokens !== null
      ? Math.round(((tokensOverage / 1000) * overagePricePer1000Tokens) * 100) / 100
      : tokensOverage === 0
        ? 0
        : null;

  let status: TokenUsageSummary["status"];
  if (!hasUsage && packagesActive === 0) {
    status = "to_configure";
  } else if (!hasUsage && packagesActive > 0) {
    // package configuré mais pas encore d'instrumentation
    status = "partial";
  } else {
    status = "ready";
  }

  return {
    tenant: slug,
    displayName,
    monthIso: iso,
    tokensIncludedMonthly,
    tokensConsumedMonth,
    tokensRemaining,
    tokensOverage,
    estimatedCostMonth,
    overagePricePer1000Tokens,
    estimatedOverageAmount,
    packagesActive,
    status,
    hasUsage,
    currency,
  };
}

/**
 * Charge l'historique brut sur les 30 derniers jours pour un tenant.
 */
export async function getTokenUsageDaily(
  slug: string,
  days = 30
): Promise<TokenUsageDailyRow[]> {
  try {
    const t = await adminQuery<{ id: string }>(
      "SELECT id FROM core.tenant WHERE slug = $1",
      [slug]
    );
    if (!t[0]) return [];
    const tenantId = t[0].id;
    const rows = await adminQuery<{
      usage_date: string;
      agent_slug: string;
      provider: string;
      model: string;
      tokens_input: string;
      tokens_output: string;
      tokens_total: string;
      estimated_cost: string | null;
      request_count: string;
    }>(
      `SELECT to_char(usage_date, 'YYYY-MM-DD') AS usage_date,
              agent_slug, provider, model,
              tokens_input, tokens_output, tokens_total,
              estimated_cost, request_count
         FROM core.token_usage
        WHERE tenant_id = $1
          AND usage_date >= (CURRENT_DATE - ($2 || ' days')::interval)
        ORDER BY usage_date DESC, agent_slug`,
      [tenantId, String(days)]
    );
    return rows.map((r) => ({
      date: r.usage_date,
      agentSlug: r.agent_slug,
      provider: r.provider,
      model: r.model,
      tokensInput: Number(r.tokens_input) || 0,
      tokensOutput: Number(r.tokens_output) || 0,
      tokensTotal: Number(r.tokens_total) || 0,
      estimatedCost: r.estimated_cost != null ? parseFloat(r.estimated_cost) : null,
      requestCount: Number(r.request_count) || 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Liste tous les tenants actifs avec leur résumé tokens du mois courant.
 */
export async function getAllTenantsTokenSummary(): Promise<TokenUsageSummary[]> {
  try {
    const slugs = await adminQuery<{ slug: string }>(
      "SELECT slug FROM core.tenant WHERE status = 'active' ORDER BY slug"
    );
    const summaries = await Promise.all(slugs.map((r) => getTokenUsageSummary(r.slug)));
    return summaries;
  } catch {
    return [];
  }
}
