// Bloc 6C — KPI Finance lecture seule, MVP strict.
//
// Doctrine :
//   - Aucune donnée fictive.
//   - Si une source fiable manque → status="to_configure" + value=null.
//   - JAMAIS de calcul MRR à partir de monthlyMaintenance × N.
//   - monthlyMaintenance = tarif de référence, pas un revenu.
//   - tenant résolu par hostname, gate par feature `finance`.
//
// Sources autorisées (MVP) :
//   - Dolibarr tenant courant : thirdparties, projects, proposals, invoices
//   - core.tenant_settings.business_model du tenant courant
//   - core.tenant count (activité écosystème)

import {
  getThirdParties,
  getProjects,
  getProposals,
  getInvoices,
} from "@/lib/dolibarr";
import { adminQuery } from "@/lib/admin-db";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";
import { getCockpitFeatures } from "@/lib/tenant-features";
import { getTokenUsageSummary } from "@/lib/token-usage";
import type { TenantBusinessModel } from "@/lib/tenant-admin-config";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

type KpiStatus = "ready" | "partial" | "to_configure" | "error";

interface Kpi {
  id: string;
  label: string;
  value: number | string | null;
  unit?: "EUR" | "count" | string;
  status: KpiStatus;
  note?: string;
}

interface KpiSection {
  id: string;
  title: string;
  kpis: Kpi[];
}

interface KpiPayload {
  tenant: string;
  displayName: string | null;
  currency: string;
  generatedAt: string;
  sources: {
    dolibarr: "ok" | "error" | "skipped";
    core: "ok" | "error";
    businessModel: "ok" | "missing";
  };
  sections: KpiSection[];
}

function k(
  id: string,
  label: string,
  value: number | string | null,
  status: KpiStatus,
  unit?: string,
  note?: string
): Kpi {
  return { id, label, value, status, unit, note };
}

export async function GET(request: Request) {
  const featureCheck = await requireFeature(request, "finance");
  if (!featureCheck.ok) return featureCheck.response;

  const cockpit = await resolveCockpitTenants(request);
  if (!cockpit.ok) {
    return Response.json(
      { error: cockpit.error },
      { status: cockpit.status, headers: NO_STORE }
    );
  }
  const { tenant, slug: tenantSlug } = cockpit;

  // 1. Lire businessModel + displayName depuis core
  let businessModel: TenantBusinessModel | null = null;
  let displayName: string | null = null;
  let coreOk: KpiPayload["sources"]["core"] = "ok";
  try {
    const rows = await adminQuery<{
      display_name: string;
      business_model: TenantBusinessModel | null;
    }>(
      `SELECT t.display_name, s.business_model
       FROM core.tenant t
       LEFT JOIN core.tenant_settings s ON s.tenant_id = t.id
       WHERE t.slug = $1`,
      [tenantSlug]
    );
    if (rows[0]) {
      displayName = rows[0].display_name;
      businessModel = rows[0].business_model;
    }
  } catch {
    coreOk = "error";
  }
  const currency = (businessModel?.currency as string) || "EUR";

  // 2. Tenants count écosystème (info contextuelle uniquement)
  let tenantsActiveCount: number | null = null;
  try {
    const r = await adminQuery<{ c: string }>(
      "SELECT COUNT(*) AS c FROM core.tenant WHERE status='active'"
    );
    tenantsActiveCount = Number(r[0]?.c) || 0;
  } catch {
    /* coreOk déjà géré au-dessus */
  }

  // 3. Lire Dolibarr du tenant courant
  let dolibarrStatus: KpiPayload["sources"]["dolibarr"] = "ok";
  let thirdparties: Awaited<ReturnType<typeof getThirdParties>> = [];
  let projects: Awaited<ReturnType<typeof getProjects>> = [];
  let proposals: Awaited<ReturnType<typeof getProposals>> = [];
  let invoices: Awaited<ReturnType<typeof getInvoices>> = [];
  try {
    [thirdparties, projects, proposals, invoices] = await Promise.all([
      getThirdParties(500, tenant),
      getProjects(500, tenant),
      getProposals(500, tenant),
      getInvoices(500, tenant),
    ]);
  } catch {
    dolibarrStatus = "error";
  }

  // 4. Calculs réels (uniquement si Dolibarr OK)
  const sumNum = (arr: Array<{ total_ttc: string | null }>) =>
    arr.reduce((s, x) => s + parseFloat(x.total_ttc || "0"), 0);

  // Proposals (devis) — statuts Dolibarr :
  //   0=draft, 1=validated/envoyé, 2=signed, 3=refused, 4=billed
  const propByStatus = (st: string) => proposals.filter((p) => p.statut === st);
  const propSigned = [...propByStatus("2"), ...propByStatus("4")];
  const propPipeline = propByStatus("1");
  const propDraft = propByStatus("0");

  // Invoices :
  //   paye='1' = encaissé ; status=0 = draft ; date_lim_reglement passée + !paye = retard
  const today = new Date().toISOString().slice(0, 10);
  const invPaid = invoices.filter((i) => i.paye === "1");
  const invSent = invoices.filter((i) => i.paye !== "1" && i.status !== "0");
  const invDraft = invoices.filter((i) => i.status === "0");
  const invLate = invSent.filter((i) => {
    const dueRaw = i.date_lim_reglement;
    if (!dueRaw) return false;
    const due = new Date(typeof dueRaw === "number" ? dueRaw * 1000 : dueRaw)
      .toISOString()
      .slice(0, 10);
    return due < today;
  });

  const activeClients = thirdparties.filter((t) => t.status !== "0").length;
  const activeProjects = projects.filter((p) => p.status === "1").length;

  // 5. Construire les sections
  const sections: KpiSection[] = [];

  // Synthèse — méta-information cockpit
  sections.push({
    id: "synthesis",
    title: "Synthèse",
    kpis: [
      k(
        "tenant",
        "Cockpit",
        displayName || tenantSlug,
        coreOk === "ok" ? "ready" : "partial"
      ),
      k(
        "currency",
        "Devise",
        currency,
        businessModel?.currency ? "ready" : "partial"
      ),
      k(
        "ecosystem-tenants",
        "Tenants actifs (écosystème)",
        tenantsActiveCount,
        coreOk === "ok" && tenantsActiveCount !== null ? "ready" : "to_configure",
        "count"
      ),
    ],
  });

  // One-shot
  sections.push({
    id: "oneshot",
    title: "One-shot (devis & projets)",
    kpis: [
      k(
        "oneshot-signed-amount",
        "CA one-shot signé",
        dolibarrStatus === "ok" ? Math.round(sumNum(propSigned)) : null,
        dolibarrStatus === "ok" ? "ready" : "error",
        currency,
        "Devis statut signé ou facturé"
      ),
      k(
        "oneshot-signed-count",
        "Devis signés",
        dolibarrStatus === "ok" ? propSigned.length : null,
        dolibarrStatus === "ok" ? "ready" : "error",
        "count"
      ),
      k(
        "oneshot-pipeline-amount",
        "CA one-shot pipeline",
        dolibarrStatus === "ok" ? Math.round(sumNum(propPipeline)) : null,
        dolibarrStatus === "ok" ? "ready" : "error",
        currency,
        "Devis envoyés en attente de signature"
      ),
      k(
        "oneshot-pipeline-count",
        "Devis en attente",
        dolibarrStatus === "ok" ? propPipeline.length : null,
        dolibarrStatus === "ok" ? "ready" : "error",
        "count"
      ),
      k(
        "oneshot-draft-count",
        "Devis brouillons",
        dolibarrStatus === "ok" ? propDraft.length : null,
        dolibarrStatus === "ok" ? "ready" : "error",
        "count"
      ),
    ],
  });

  // Récurrent — Bloc 6D : lecture core.subscriptions du tenant courant.
  // Bloc 6E : agrège aussi les tokens inclus / prix dépassement / mode
  // depuis subs active de category=tokens_package.
  let subsActive = 0;
  let subsSetup = 0;
  let subsPaused = 0;
  let mrrConfigured = 0;
  let subsSourceOk = true;
  let tokensIncludedTotal = 0; // somme included_monthly_tokens (subs active)
  let tokensPackagesActive = 0;
  let overagePriceSample: number | null = null;
  let tokenBillingModeSample: string | null = null;
  try {
    const subRows = await adminQuery<{
      status: string;
      category: string;
      monthly_amount: string;
      included_monthly_tokens: string | null;
      overage_price_per_1000_tokens: string | null;
      token_billing_mode: string | null;
    }>(
      `SELECT s.status, s.category, s.monthly_amount,
              s.included_monthly_tokens, s.overage_price_per_1000_tokens,
              s.token_billing_mode
         FROM core.subscriptions s
         JOIN core.tenant t ON t.id = s.tenant_id
        WHERE t.slug = $1`,
      [tenantSlug]
    );
    for (const r of subRows) {
      const amt = parseFloat(r.monthly_amount) || 0;
      if (r.status === "active") {
        subsActive += 1;
        mrrConfigured += amt;
        if (r.category === "tokens_package") {
          tokensPackagesActive += 1;
          if (r.included_monthly_tokens != null) {
            tokensIncludedTotal += Number(r.included_monthly_tokens) || 0;
          }
          if (overagePriceSample === null && r.overage_price_per_1000_tokens != null) {
            overagePriceSample = parseFloat(r.overage_price_per_1000_tokens);
          }
          if (tokenBillingModeSample === null && r.token_billing_mode) {
            tokenBillingModeSample = r.token_billing_mode;
          }
        }
      } else if (r.status === "setup") {
        subsSetup += 1;
      } else if (r.status === "paused") {
        subsPaused += 1;
      }
    }
  } catch {
    subsSourceOk = false;
  }
  const arrConfigured = mrrConfigured * 12;
  const noActiveSubs = subsActive === 0;

  sections.push({
    id: "recurring",
    title: "Revenus récurrents (configurés)",
    kpis: [
      k(
        "mrr",
        "MRR configuré",
        subsSourceOk ? Math.round(mrrConfigured) : null,
        subsSourceOk ? (noActiveSubs ? "partial" : "ready") : "error",
        currency,
        subsSourceOk
          ? noActiveSubs
            ? "Aucun abonnement statut 'active'. Configure dans /admin/tenants."
            : `Somme des ${subsActive} abonnements actifs.`
          : "Source subscriptions indisponible."
      ),
      k(
        "arr",
        "ARR configuré (MRR × 12)",
        subsSourceOk ? Math.round(arrConfigured) : null,
        subsSourceOk ? (noActiveSubs ? "partial" : "ready") : "error",
        currency,
        "Annualisation du MRR configuré."
      ),
      k(
        "active-subs",
        "Abonnements actifs",
        subsSourceOk ? subsActive : null,
        subsSourceOk ? "ready" : "error",
        "count"
      ),
      k(
        "setup-subs",
        "Abonnements en setup",
        subsSourceOk ? subsSetup : null,
        subsSourceOk ? "ready" : "error",
        "count",
        "À facturer dès activation."
      ),
      k(
        "paused-subs",
        "Abonnements en pause",
        subsSourceOk ? subsPaused : null,
        subsSourceOk ? "ready" : "error",
        "count"
      ),
      k(
        "monthly-maintenance-ref",
        "Tarif maintenance mensuelle (référence)",
        businessModel?.monthlyMaintenance ?? null,
        businessModel?.monthlyMaintenance ? "partial" : "to_configure",
        currency,
        "Paramètre commercial, PAS un revenu réalisé."
      ),
    ],
  });

  // Tokens IA — Bloc 6E inclus + Bloc 6F consommation réelle via core.token_usage.
  const hasTokenPackage = tokensPackagesActive > 0;
  const tokenSummary = await getTokenUsageSummary(tenantSlug);
  const hasUsage = tokenSummary.hasUsage;
  const consumedReady = hasUsage;
  sections.push({
    id: "tokens",
    title: "Tokens IA",
    kpis: [
      k(
        "tokens-included-monthly",
        "Tokens inclus / mois (configurés)",
        subsSourceOk ? (hasTokenPackage ? tokensIncludedTotal : 0) : null,
        subsSourceOk
          ? hasTokenPackage
            ? "ready"
            : "to_configure"
          : "error",
        "tokens",
        hasTokenPackage
          ? `Somme des ${tokensPackagesActive} package(s) tokens active.`
          : "Configure un abonnement category=tokens_package dans /admin/tenants pour activer."
      ),
      k(
        "tokens-overage-price-1k",
        "Prix dépassement / 1 000 tokens",
        overagePriceSample,
        overagePriceSample !== null ? "partial" : "to_configure",
        currency,
        overagePriceSample !== null
          ? "Lecture du premier package tokens trouvé. Multi-package = à harmoniser."
          : "Configure overagePricePer1000Tokens sur un package tokens."
      ),
      k(
        "token-billing-mode",
        "Mode facturation tokens",
        tokenBillingModeSample,
        tokenBillingModeSample ? "partial" : "to_configure",
        undefined,
        "Lecture du premier package tokens. Voir Bloc 6F pour consommation réelle."
      ),
      k(
        "tokens-consumed",
        "Tokens consommés (mois)",
        consumedReady ? tokenSummary.tokensConsumedMonth : null,
        consumedReady ? "ready" : "to_configure",
        "tokens",
        consumedReady
          ? `${tokenSummary.monthIso} via core.token_usage`
          : "Aucune ligne core.token_usage pour ce mois. Instrumentation à brancher (claude-bridge / api-mybotia)."
      ),
      k(
        "tokens-remaining",
        "Tokens restants (inclus - consommés)",
        tokenSummary.tokensRemaining,
        tokenSummary.tokensRemaining !== null && hasUsage ? "ready" :
          tokenSummary.tokensRemaining !== null ? "partial" : "to_configure",
        "tokens"
      ),
      k(
        "tokens-overage-amount",
        "Tokens en dépassement",
        tokenSummary.tokensIncludedMonthly !== null && hasUsage ? tokenSummary.tokensOverage : null,
        tokenSummary.tokensIncludedMonthly !== null && hasUsage ? "ready" : "to_configure",
        "tokens"
      ),
      k(
        "tokens-overage-cost",
        "Surcoût tokens estimé",
        tokenSummary.estimatedOverageAmount,
        tokenSummary.estimatedOverageAmount !== null && hasUsage ? "ready" :
          tokenSummary.estimatedOverageAmount !== null ? "partial" : "to_configure",
        currency,
        tokenSummary.overagePricePer1000Tokens === null
          ? "Configure overagePricePer1000Tokens sur un package tokens."
          : "Calculé : (consommés - inclus) / 1000 × prix dépassement."
      ),
      k(
        "tokens-cost-month",
        "Coût tokens estimé du mois",
        tokenSummary.estimatedCostMonth,
        tokenSummary.estimatedCostMonth !== null && hasUsage ? "ready" : "to_configure",
        currency,
        "Somme estimated_cost dans core.token_usage."
      ),
      k(
        "token-billing-mode-ref",
        "Mode facturation (business_model réf.)",
        (businessModel?.tokenBillingMode as string) || null,
        businessModel?.tokenBillingMode ? "partial" : "to_configure",
        undefined,
        "Paramètre commercial du business_model — distinct des packages réellement vendus."
      ),
    ],
  });

  // Activité commerciale — vraie donnée Dolibarr
  sections.push({
    id: "activity",
    title: "Activité commerciale",
    kpis: [
      k(
        "clients-count",
        "Clients/tiers actifs",
        dolibarrStatus === "ok" ? activeClients : null,
        dolibarrStatus === "ok" ? "ready" : "error",
        "count"
      ),
      k(
        "projects-active",
        "Projets actifs",
        dolibarrStatus === "ok" ? activeProjects : null,
        dolibarrStatus === "ok" ? "ready" : "error",
        "count"
      ),
      k(
        "proposals-total",
        "Devis (tous statuts)",
        dolibarrStatus === "ok" ? proposals.length : null,
        dolibarrStatus === "ok" ? "ready" : "error",
        "count"
      ),
      k(
        "invoices-total",
        "Factures (tous statuts)",
        dolibarrStatus === "ok" ? invoices.length : null,
        dolibarrStatus === "ok" ? "ready" : "error",
        "count"
      ),
    ],
  });

  // Pipeline + facturation
  sections.push({
    id: "billing",
    title: "Facturation & encaissement",
    kpis: [
      k(
        "billed-amount",
        "CA facturé (envoyé+payé)",
        dolibarrStatus === "ok"
          ? Math.round(sumNum(invSent) + sumNum(invPaid))
          : null,
        dolibarrStatus === "ok" ? "ready" : "error",
        currency,
        "Factures non-draft"
      ),
      k(
        "paid-amount",
        "CA encaissé",
        dolibarrStatus === "ok" ? Math.round(sumNum(invPaid)) : null,
        dolibarrStatus === "ok" ? "ready" : "error",
        currency,
        "Factures paye=1"
      ),
      k(
        "late-amount",
        "Factures en retard",
        dolibarrStatus === "ok" ? Math.round(sumNum(invLate)) : null,
        dolibarrStatus === "ok" ? "ready" : "error",
        currency,
        `${invLate.length} facture(s)`
      ),
      k(
        "draft-count",
        "Factures brouillons",
        dolibarrStatus === "ok" ? invDraft.length : null,
        dolibarrStatus === "ok" ? "ready" : "error",
        "count"
      ),
    ],
  });

  // Référence (paramètres business_model lus, pas additionnés)
  if (businessModel) {
    sections.push({
      id: "reference",
      title: "Tarifs de référence (paramètres commerciaux)",
      kpis: [
        k(
          "setup-daily-rate",
          "Taux journalier setup",
          businessModel.setupDailyRate ?? null,
          businessModel.setupDailyRate != null ? "partial" : "to_configure",
          currency,
          "Tarif catalogue, pas un revenu."
        ),
        k(
          "monthly-maintenance",
          "Maintenance mensuelle",
          businessModel.monthlyMaintenance ?? null,
          businessModel.monthlyMaintenance != null ? "partial" : "to_configure",
          currency,
          "Tarif catalogue par client, pas un MRR."
        ),
        k(
          "has-one-shot",
          "One-shot activé",
          businessModel.hasOneShot ? "oui" : "non",
          "ready"
        ),
        k(
          "has-recurring",
          "Récurrent activé",
          businessModel.hasRecurring ? "oui" : "non",
          "ready"
        ),
        k(
          "kpi-status",
          "Statut KPI global",
          (businessModel.kpiStatus as string) || "unknown",
          "partial",
          undefined,
          "Défini dans /admin/tenants. 'to_configure' = sources MRR/tokens à brancher."
        ),
      ],
    });
  }

  const payload: KpiPayload = {
    tenant: tenantSlug,
    displayName,
    currency,
    generatedAt: new Date().toISOString(),
    sources: {
      dolibarr: dolibarrStatus,
      core: coreOk,
      businessModel: businessModel ? "ok" : "missing",
    },
    sections,
  };

  // Touch features cache so future calls reuse same value
  await getCockpitFeatures(request);

  return Response.json(payload, { headers: NO_STORE });
}
