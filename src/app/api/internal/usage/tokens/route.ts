// Bloc 6G — Route INTERNE : alimentation core.token_usage par claude-bridge.
//
// Doctrine sécurité :
//   - Bearer token MYBOTIA_INTERNAL_TOKEN obligatoire (env partagée bridge↔app).
//   - Aucun contenu utilisateur loggé.
//   - Aucun secret rendu dans les réponses.
//   - Pas de durcissement IP/host dans ce bloc (le Bearer fort suffit).
//     Le durcissement Nginx/local-only sera ajouté dans un bloc hardening dédié.
//
// UPSERT idempotent journalier sur :
//   (tenant_id, agent_slug, provider, model, usage_date, source)
//
// Source attendue : 'bridge' par claude-bridge, 'bridge-test' pour tests manuels.

import { adminQuery } from "@/lib/admin-db";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

function todayUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface UsagePayload {
  tenantSlug: string;
  agentSlug: string;
  provider: string;
  model: string;
  usageDate?: string; // ISO YYYY-MM-DD, default today UTC
  tokensInput?: number;
  tokensOutput?: number;
  tokensTotal?: number;
  estimatedCost?: number | null;
  source?: string; // default 'bridge'
  requestCount?: number; // default 1
  // UB-10
  serviceTier?: string | null;
  clientCostEstimated?: number | null;
}

const SERVICE_TIERS_ALLOWED = new Set(["standard", "premium", "background", "system"]);

interface ValidatedUsage {
  tenantSlug: string;
  agentSlug: string;
  provider: string;
  model: string;
  usageDate: string;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  estimatedCost: number | null;
  source: string;
  requestCount: number;
  serviceTier: string | null;
  clientCostEstimated: number | null;
}

function validate(body: unknown): { ok: true; data: ValidatedUsage } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "body invalide" };
  const b = body as Record<string, unknown>;
  if (typeof b.tenantSlug !== "string" || !b.tenantSlug) return { ok: false, error: "tenantSlug requis" };
  if (typeof b.agentSlug !== "string" || !b.agentSlug) return { ok: false, error: "agentSlug requis" };
  if (typeof b.provider !== "string" || !b.provider) return { ok: false, error: "provider requis" };
  if (typeof b.model !== "string" || !b.model) return { ok: false, error: "model requis" };

  const num = (v: unknown, def: number): number => {
    if (v === undefined || v === null) return def;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return -1;
    return n;
  };
  const tokensInput = num(b.tokensInput, 0);
  const tokensOutput = num(b.tokensOutput, 0);
  let tokensTotal = num(b.tokensTotal, 0);
  const requestCount = num(b.requestCount, 1);
  if (tokensInput < 0) return { ok: false, error: "tokensInput >= 0 requis" };
  if (tokensOutput < 0) return { ok: false, error: "tokensOutput >= 0 requis" };
  if (tokensTotal < 0) return { ok: false, error: "tokensTotal >= 0 requis" };
  if (requestCount < 0) return { ok: false, error: "requestCount >= 0 requis" };
  // Si tokensTotal=0 et input/output > 0 : on déduit
  if (tokensTotal === 0 && (tokensInput > 0 || tokensOutput > 0)) {
    tokensTotal = tokensInput + tokensOutput;
  }

  let estimatedCost: number | null = null;
  if (b.estimatedCost !== undefined && b.estimatedCost !== null) {
    const c = Number(b.estimatedCost);
    if (!Number.isFinite(c) || c < 0) return { ok: false, error: "estimatedCost >= 0 ou null" };
    estimatedCost = c;
  }

  const source = typeof b.source === "string" && b.source ? b.source : "bridge";

  const usageDate = typeof b.usageDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.usageDate)
    ? b.usageDate
    : todayUtc();

  // UB-10 : serviceTier — whitelist soft (valeur inconnue → NULL, pas d'erreur).
  let serviceTier: string | null = null;
  if (typeof b.serviceTier === "string" && b.serviceTier) {
    const v = b.serviceTier.toLowerCase().trim();
    if (SERVICE_TIERS_ALLOWED.has(v)) serviceTier = v;
  }

  // UB-10 : clientCostEstimated — explicite si fourni, sinon NULL et calculé côté DB lookup.
  let clientCostEstimated: number | null = null;
  if (b.clientCostEstimated !== undefined && b.clientCostEstimated !== null) {
    const c = Number(b.clientCostEstimated);
    if (!Number.isFinite(c) || c < 0) return { ok: false, error: "clientCostEstimated >= 0 ou null" };
    clientCostEstimated = c;
  }

  return {
    ok: true,
    data: {
      tenantSlug: b.tenantSlug,
      agentSlug: b.agentSlug,
      provider: b.provider,
      model: b.model,
      usageDate,
      tokensInput: Math.floor(tokensInput),
      tokensOutput: Math.floor(tokensOutput),
      tokensTotal: Math.floor(tokensTotal),
      estimatedCost,
      source,
      requestCount: Math.floor(requestCount),
      serviceTier,
      clientCostEstimated,
    },
  };
}

export async function POST(request: Request) {
  // 1. Auth Bearer
  const expected = process.env.MYBOTIA_INTERNAL_TOKEN;
  if (!expected) {
    // config manquante côté serveur — pas de log de la valeur
    return Response.json(
      { error: "internal_misconfigured" },
      { status: 500, headers: NO_STORE }
    );
  }
  const auth = request.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m || m[1] !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  // 2. Diagnostic minimal (presence flags only, pas les valeurs)
  if (process.env.MYBOTIA_INTERNAL_DEBUG === "1") {
    console.log(
      "[6G/internal/usage/tokens] auth=ok",
      "xff=", request.headers.get("x-forwarded-for") ? "present" : "absent",
      "xri=", request.headers.get("x-real-ip") ? "present" : "absent",
      "host=", request.headers.get("host") ? "present" : "absent",
    );
  }

  // 3. Validation payload
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body json invalide" }, { status: 400, headers: NO_STORE });
  }
  const v = validate(body);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400, headers: NO_STORE });
  const d = v.data;

  // 4. Résolution tenant_id + markup (UB-10)
  try {
    const t = await adminQuery<{ id: string; markup: string | null }>(
      `SELECT t.id,
              (SELECT s.ai_markup_rate
                 FROM core.subscriptions s
                WHERE s.tenant_id = t.id
                  AND s.category = 'ai_collaborator'
                  AND s.status   = 'active'
                LIMIT 1) AS markup
         FROM core.tenant t
        WHERE t.slug = $1`,
      [d.tenantSlug]
    );
    if (!t[0]) {
      return Response.json({ error: "tenant_unknown" }, { status: 400, headers: NO_STORE });
    }
    const tenantId = t[0].id;
    const tenantMarkup = t[0].markup === null ? 1.2 : Number(t[0].markup);

    // UB-10 : si le caller n'a pas calculé clientCostEstimated, on le déduit
    // de estimatedCost × markup tenant (fallback 1.20). Sinon on utilise la
    // valeur explicite reçue (priorité au caller).
    const clientCost: number | null =
      d.clientCostEstimated !== null
        ? d.clientCostEstimated
        : d.estimatedCost === null
        ? null
        : Math.round(d.estimatedCost * tenantMarkup * 1_000_000) / 1_000_000;

    // 5. UPSERT idempotent journalier
    // Cumul tokens, cost (avec règle null), request_count.
    // estimated_cost et client_cost_estimated : si les deux NULL → reste NULL ; sinon somme COALESCE(0).
    // service_tier : COALESCE — on garde la valeur précédente si la nouvelle est NULL.
    await adminQuery(
      `INSERT INTO core.token_usage
         (tenant_id, agent_slug, provider, model, usage_date,
          tokens_input, tokens_output, tokens_total,
          estimated_cost, source, request_count,
          service_tier, client_cost_estimated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (tenant_id, agent_slug, provider, model, usage_date, source)
       DO UPDATE SET
         tokens_input  = core.token_usage.tokens_input  + EXCLUDED.tokens_input,
         tokens_output = core.token_usage.tokens_output + EXCLUDED.tokens_output,
         tokens_total  = core.token_usage.tokens_total  + EXCLUDED.tokens_total,
         estimated_cost = CASE
           WHEN core.token_usage.estimated_cost IS NULL AND EXCLUDED.estimated_cost IS NULL THEN NULL
           ELSE COALESCE(core.token_usage.estimated_cost, 0) + COALESCE(EXCLUDED.estimated_cost, 0)
         END,
         request_count = core.token_usage.request_count + EXCLUDED.request_count,
         service_tier  = COALESCE(EXCLUDED.service_tier, core.token_usage.service_tier),
         client_cost_estimated = CASE
           WHEN core.token_usage.client_cost_estimated IS NULL AND EXCLUDED.client_cost_estimated IS NULL THEN NULL
           ELSE COALESCE(core.token_usage.client_cost_estimated, 0) + COALESCE(EXCLUDED.client_cost_estimated, 0)
         END`,
      [
        tenantId,
        d.agentSlug,
        d.provider,
        d.model,
        d.usageDate,
        d.tokensInput,
        d.tokensOutput,
        d.tokensTotal,
        d.estimatedCost,
        d.source,
        d.requestCount,
        d.serviceTier,
        clientCost,
      ]
    );

    return Response.json(
      {
        ok: true,
        tenant: d.tenantSlug,
        date: d.usageDate,
        source: d.source,
        serviceTier: d.serviceTier,
        clientCostEstimated: clientCost,
        markupApplied: d.clientCostEstimated !== null ? null : tenantMarkup,
      },
      { status: 200, headers: NO_STORE }
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}
