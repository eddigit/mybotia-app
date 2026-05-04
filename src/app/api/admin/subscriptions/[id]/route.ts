// Bloc 6D — PATCH abonnement.
// Whitelist stricte. Validation montant >= 0. Pas de DELETE (cancel via PATCH).

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

const ALLOWED_PATCH = [
  "clientName",
  "clientRef",
  "label",
  "category",
  "status",
  "monthlyAmount",
  "currency",
  "startDate",
  "endDate",
  "billingPeriod",
  "notes",
  // Bloc 6E
  "includedMonthlyTokens",
  "overagePricePer1000Tokens",
  "tokenBillingMode",
] as const;

const FIELD_MAP: Record<string, string> = {
  clientName: "client_name",
  clientRef: "client_ref",
  label: "label",
  category: "category",
  status: "status",
  monthlyAmount: "monthly_amount",
  currency: "currency",
  startDate: "start_date",
  endDate: "end_date",
  billingPeriod: "billing_period",
  notes: "notes",
  includedMonthlyTokens: "included_monthly_tokens",
  overagePricePer1000Tokens: "overage_price_per_1000_tokens",
  tokenBillingMode: "token_billing_mode",
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: "id abonnement invalide" }, { status: 400, headers: NO_STORE });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "body json invalide" }, { status: 400, headers: NO_STORE });
  }

  const sets: string[] = [];
  const args: unknown[] = [];

  for (const k of ALLOWED_PATCH) {
    if (!(k in body)) continue;
    const v = body[k];
    if (v === undefined) continue;

    // Validation par champ
    if (k === "category") {
      if (typeof v !== "string" || !SUBSCRIPTION_CATEGORIES.includes(v as SubscriptionCategory)) {
        return Response.json(
          { error: `category invalide (allowed: ${SUBSCRIPTION_CATEGORIES.join(", ")})` },
          { status: 400, headers: NO_STORE }
        );
      }
    }
    if (k === "status") {
      if (typeof v !== "string" || !SUBSCRIPTION_STATUSES.includes(v as SubscriptionStatus)) {
        return Response.json(
          { error: `status invalide (allowed: ${SUBSCRIPTION_STATUSES.join(", ")})` },
          { status: 400, headers: NO_STORE }
        );
      }
    }
    if (k === "billingPeriod") {
      if (typeof v !== "string" || !BILLING_PERIODS.includes(v as BillingPeriod)) {
        return Response.json(
          { error: `billingPeriod invalide (allowed: ${BILLING_PERIODS.join(", ")})` },
          { status: 400, headers: NO_STORE }
        );
      }
    }
    if (k === "monthlyAmount") {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n) || n < 0) {
        return Response.json(
          { error: "monthlyAmount doit etre un nombre >= 0" },
          { status: 400, headers: NO_STORE }
        );
      }
      args.push(n);
      sets.push(`${FIELD_MAP[k]} = $${args.length}`);
      continue;
    }
    // Bloc 6E — tokens (nullable, mais validation si fourni)
    if (k === "includedMonthlyTokens") {
      if (v === null) {
        sets.push(`${FIELD_MAP[k]} = NULL`);
        continue;
      }
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n) || n < 0) {
        return Response.json(
          { error: "includedMonthlyTokens doit etre un entier >= 0 ou null" },
          { status: 400, headers: NO_STORE }
        );
      }
      args.push(Math.floor(n));
      sets.push(`${FIELD_MAP[k]} = $${args.length}`);
      continue;
    }
    if (k === "overagePricePer1000Tokens") {
      if (v === null) {
        sets.push(`${FIELD_MAP[k]} = NULL`);
        continue;
      }
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n) || n < 0) {
        return Response.json(
          { error: "overagePricePer1000Tokens doit etre un nombre >= 0 ou null" },
          { status: 400, headers: NO_STORE }
        );
      }
      args.push(n);
      sets.push(`${FIELD_MAP[k]} = $${args.length}`);
      continue;
    }
    if (k === "tokenBillingMode") {
      if (v === null) {
        sets.push(`${FIELD_MAP[k]} = NULL`);
        continue;
      }
      if (typeof v !== "string" || !TOKEN_BILLING_MODES.includes(v as TokenBillingMode)) {
        return Response.json(
          { error: `tokenBillingMode invalide (allowed: ${TOKEN_BILLING_MODES.join(", ")})` },
          { status: 400, headers: NO_STORE }
        );
      }
      args.push(v);
      sets.push(`${FIELD_MAP[k]} = $${args.length}`);
      continue;
    }
    if (k === "clientName" || k === "label") {
      if (typeof v !== "string" || !v.trim()) {
        return Response.json(
          { error: `${k} doit etre une chaine non vide` },
          { status: 400, headers: NO_STORE }
        );
      }
      args.push(v.trim());
      sets.push(`${FIELD_MAP[k]} = $${args.length}`);
      continue;
    }
    // string nullable champs
    args.push(v === null ? null : String(v));
    sets.push(`${FIELD_MAP[k]} = $${args.length}`);
  }

  if (sets.length === 0) {
    return Response.json(
      { error: `aucun champ valide a mettre a jour (allowed: ${ALLOWED_PATCH.join(", ")})` },
      { status: 400, headers: NO_STORE }
    );
  }

  try {
    args.push(id);
    const updated = await adminQuery<Row>(
      `UPDATE core.subscriptions s SET ${sets.join(", ")}
         WHERE s.id = $${args.length}
       RETURNING s.id, s.tenant_id,
         (SELECT slug FROM core.tenant WHERE id = s.tenant_id) AS tenant_slug,
         s.client_name, s.client_ref, s.label, s.category, s.status,
         s.monthly_amount, s.currency, s.start_date, s.end_date,
         s.billing_period, s.notes,
         s.included_monthly_tokens, s.overage_price_per_1000_tokens, s.token_billing_mode,
         to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
         to_char(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`,
      args
    );

    if (!updated[0]) {
      return Response.json({ error: "abonnement introuvable" }, { status: 404, headers: NO_STORE });
    }

    return Response.json({ subscription: mapRow(updated[0]) }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}
