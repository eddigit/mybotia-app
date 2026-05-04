// Bloc 6D — API admin abonnements.
//   GET  /api/admin/subscriptions?tenant=<slug>  → liste
//   POST /api/admin/subscriptions                → création
// ACL : superadmin uniquement (pas de RLS-only).

import { adminQuery } from "@/lib/admin-db";
import { requireSuperadmin } from "@/lib/admin-auth";
import {
  SUBSCRIPTION_CATEGORIES,
  SUBSCRIPTION_STATUSES,
  BILLING_PERIODS,
  TOKEN_BILLING_MODES,
  type Subscription,
  type SubscriptionCategory,
  type SubscriptionStatus,
  type BillingPeriod,
  type TokenBillingMode,
} from "@/lib/subscription-types";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

interface Row {
  id: string;
  tenant_id: string;
  tenant_slug: string;
  client_name: string;
  client_ref: string | null;
  label: string;
  category: SubscriptionCategory;
  status: SubscriptionStatus;
  monthly_amount: string;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  billing_period: BillingPeriod;
  notes: string | null;
  included_monthly_tokens: string | null;
  overage_price_per_1000_tokens: string | null;
  token_billing_mode: TokenBillingMode | null;
  created_at: string;
  updated_at: string;
}

function mapRow(r: Row): Subscription {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    tenantSlug: r.tenant_slug,
    clientName: r.client_name,
    clientRef: r.client_ref,
    label: r.label,
    category: r.category,
    status: r.status,
    monthlyAmount: parseFloat(r.monthly_amount) || 0,
    currency: r.currency,
    startDate: r.start_date,
    endDate: r.end_date,
    billingPeriod: r.billing_period,
    notes: r.notes,
    includedMonthlyTokens: r.included_monthly_tokens != null ? Number(r.included_monthly_tokens) : null,
    overagePricePer1000Tokens: r.overage_price_per_1000_tokens != null ? parseFloat(r.overage_price_per_1000_tokens) : null,
    tokenBillingMode: r.token_billing_mode,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function GET(request: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenant");
    const params: unknown[] = [];
    let where = "";
    if (tenantSlug) {
      params.push(tenantSlug);
      where = "WHERE t.slug = $1";
    }
    const rows = await adminQuery<Row>(
      `SELECT s.id, s.tenant_id, t.slug AS tenant_slug,
              s.client_name, s.client_ref, s.label, s.category, s.status,
              s.monthly_amount, s.currency, s.start_date, s.end_date,
              s.billing_period, s.notes,
              s.included_monthly_tokens, s.overage_price_per_1000_tokens, s.token_billing_mode,
              to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
              to_char(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
         FROM core.subscriptions s
         JOIN core.tenant t ON t.id = s.tenant_id
        ${where}
        ORDER BY s.created_at DESC`,
      params
    );
    return Response.json({ subscriptions: rows.map(mapRow) }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}

interface CreateBody {
  tenantSlug: string;
  clientName: string;
  clientRef?: string;
  label: string;
  category: SubscriptionCategory;
  status?: SubscriptionStatus;
  monthlyAmount: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  billingPeriod?: BillingPeriod;
  notes?: string;
  // Bloc 6E
  includedMonthlyTokens?: number | null;
  overagePricePer1000Tokens?: number | null;
  tokenBillingMode?: TokenBillingMode | null;
}

function validateCreate(body: unknown): { ok: true; data: CreateBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "body invalide" };
  const b = body as Record<string, unknown>;
  if (typeof b.tenantSlug !== "string" || !b.tenantSlug)
    return { ok: false, error: "tenantSlug requis" };
  if (typeof b.clientName !== "string" || !b.clientName.trim())
    return { ok: false, error: "clientName requis" };
  if (typeof b.label !== "string" || !b.label.trim())
    return { ok: false, error: "label requis" };
  if (typeof b.category !== "string" || !SUBSCRIPTION_CATEGORIES.includes(b.category as SubscriptionCategory))
    return { ok: false, error: `category invalide (allowed: ${SUBSCRIPTION_CATEGORIES.join(", ")})` };
  const ma = typeof b.monthlyAmount === "number" ? b.monthlyAmount : Number(b.monthlyAmount);
  if (!Number.isFinite(ma) || ma < 0)
    return { ok: false, error: "monthlyAmount doit etre un nombre >= 0" };
  if (b.status && !SUBSCRIPTION_STATUSES.includes(b.status as SubscriptionStatus))
    return { ok: false, error: `status invalide (allowed: ${SUBSCRIPTION_STATUSES.join(", ")})` };
  if (b.billingPeriod && !BILLING_PERIODS.includes(b.billingPeriod as BillingPeriod))
    return { ok: false, error: `billingPeriod invalide (allowed: ${BILLING_PERIODS.join(", ")})` };

  // Bloc 6E — validation tokens (tous optionnels)
  let includedMonthlyTokens: number | null | undefined;
  if ("includedMonthlyTokens" in b && b.includedMonthlyTokens !== undefined) {
    if (b.includedMonthlyTokens === null) {
      includedMonthlyTokens = null;
    } else {
      const n = Number(b.includedMonthlyTokens);
      if (!Number.isFinite(n) || n < 0)
        return { ok: false, error: "includedMonthlyTokens doit etre un entier >= 0" };
      includedMonthlyTokens = Math.floor(n);
    }
  }
  let overagePricePer1000Tokens: number | null | undefined;
  if ("overagePricePer1000Tokens" in b && b.overagePricePer1000Tokens !== undefined) {
    if (b.overagePricePer1000Tokens === null) {
      overagePricePer1000Tokens = null;
    } else {
      const n = Number(b.overagePricePer1000Tokens);
      if (!Number.isFinite(n) || n < 0)
        return { ok: false, error: "overagePricePer1000Tokens doit etre un nombre >= 0" };
      overagePricePer1000Tokens = n;
    }
  }
  let tokenBillingMode: TokenBillingMode | null | undefined;
  if ("tokenBillingMode" in b && b.tokenBillingMode !== undefined) {
    if (b.tokenBillingMode === null) {
      tokenBillingMode = null;
    } else if (
      typeof b.tokenBillingMode === "string" &&
      TOKEN_BILLING_MODES.includes(b.tokenBillingMode as TokenBillingMode)
    ) {
      tokenBillingMode = b.tokenBillingMode as TokenBillingMode;
    } else {
      return {
        ok: false,
        error: `tokenBillingMode invalide (allowed: ${TOKEN_BILLING_MODES.join(", ")})`,
      };
    }
  }

  return {
    ok: true,
    data: {
      tenantSlug: b.tenantSlug,
      clientName: b.clientName.trim(),
      clientRef: typeof b.clientRef === "string" ? b.clientRef : undefined,
      label: b.label.trim(),
      category: b.category as SubscriptionCategory,
      status: (b.status as SubscriptionStatus) || "active",
      monthlyAmount: ma,
      currency: typeof b.currency === "string" && b.currency ? b.currency : "EUR",
      startDate: typeof b.startDate === "string" ? b.startDate : undefined,
      endDate: typeof b.endDate === "string" ? b.endDate : undefined,
      billingPeriod: (b.billingPeriod as BillingPeriod) || "monthly",
      notes: typeof b.notes === "string" ? b.notes : undefined,
      includedMonthlyTokens,
      overagePricePer1000Tokens,
      tokenBillingMode,
    },
  };
}

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body json invalide" }, { status: 400, headers: NO_STORE });
  }
  const v = validateCreate(body);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400, headers: NO_STORE });
  const d = v.data;

  try {
    const tenantRows = await adminQuery<{ id: string }>(
      "SELECT id FROM core.tenant WHERE slug = $1",
      [d.tenantSlug]
    );
    if (!tenantRows[0]) {
      return Response.json({ error: "tenant inconnu" }, { status: 404, headers: NO_STORE });
    }
    const tenantId = tenantRows[0].id;

    const inserted = await adminQuery<Row>(
      `INSERT INTO core.subscriptions
       (tenant_id, client_name, client_ref, label, category, status,
        monthly_amount, currency, start_date, end_date, billing_period, notes,
        included_monthly_tokens, overage_price_per_1000_tokens, token_billing_mode)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id, tenant_id,
         (SELECT slug FROM core.tenant WHERE id = $1) AS tenant_slug,
         client_name, client_ref, label, category, status, monthly_amount,
         currency, start_date, end_date, billing_period, notes,
         included_monthly_tokens, overage_price_per_1000_tokens, token_billing_mode,
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
         to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`,
      [
        tenantId,
        d.clientName,
        d.clientRef || null,
        d.label,
        d.category,
        d.status,
        d.monthlyAmount,
        d.currency,
        d.startDate || null,
        d.endDate || null,
        d.billingPeriod,
        d.notes || null,
        d.includedMonthlyTokens ?? null,
        d.overagePricePer1000Tokens ?? null,
        d.tokenBillingMode ?? null,
      ]
    );

    return Response.json(
      { subscription: mapRow(inserted[0]) },
      { status: 201, headers: NO_STORE }
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}
