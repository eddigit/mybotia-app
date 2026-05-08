// Bloc 5G — /api/documents verrouillé sur le cockpit hostname.
// V1.1.B Phase 3A anti-hybride silencieux : si crm_provider=mybotia_business,
// retourne uniquement les devis/factures business du tenant. Sinon Dolibarr legacy.

import { getInvoices, getProposals, getThirdParties } from "@/lib/dolibarr";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";
import {
  getCrmProvider,
  CrmRouterError,
  crmRouterErrorResponse,
} from "@/lib/crm-router";
import { businessGetJson, BusinessClientError } from "@/lib/business-client";
import { type BusinessClient } from "@/lib/business-mappers";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

type BusinessQuoteRow = {
  id: string;
  reference: string;
  clientId: string;
  status: string;
  totalTtc: string | number;
  issuedAt: string | null;
  createdAt: string;
};
type BusinessInvoiceRow = BusinessQuoteRow;

function safeNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export async function GET(request: Request) {
  try {
    const featureCheck = await requireFeature(request, "documents");
    if (!featureCheck.ok) return featureCheck.response;

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }
    const { tenant, slug: tenantSlug } = cockpit;

    const provider = await getCrmProvider(tenantSlug);

    if (provider.kind === "external") {
      return Response.json(
        { error: "crm_provider_not_configured", tenant: tenantSlug, partial: true },
        { status: 501, headers: NO_STORE },
      );
    }

    if (provider.kind === "mybotia_business") {
      const claims = {
        tenantId: provider.tenantId,
        tenantSlug,
        scopes: ["crm:read"] as const,
      };
      const [bizClients, bizQuotes, bizInvoices] = await Promise.all([
        businessGetJson<BusinessClient[]>("/api/v1/clients", claims),
        businessGetJson<BusinessQuoteRow[]>("/api/v1/quotes", claims).catch(() => []),
        businessGetJson<BusinessInvoiceRow[]>("/api/v1/invoices", claims).catch(() => []),
      ]);
      const clientNameById: Record<string, string> = {};
      for (const c of bizClients) clientNameById[c.id] = c.name;

      const docs = [
        ...bizInvoices.map((inv) => ({
          id: `inv-${tenantSlug}-${inv.id}`,
          type: "facture" as const,
          ref: inv.reference,
          dolibarrId: inv.id, // ⚠️ champ legacy : contient maintenant un UUID business
          clientName: clientNameById[inv.clientId] || "—",
          totalTTC: safeNumber(inv.totalTtc),
          status:
            inv.status === "paid"
              ? "paid"
              : inv.status === "draft"
                ? "draft"
                : "sent",
          date: inv.issuedAt ?? inv.createdAt?.slice(0, 10) ?? "",
          modulepart: "facture",
          tenantSlug,
        })),
        ...bizQuotes.map((q) => ({
          id: `prop-${tenantSlug}-${q.id}`,
          type: "devis" as const,
          ref: q.reference,
          dolibarrId: q.id,
          clientName: clientNameById[q.clientId] || "—",
          totalTTC: safeNumber(q.totalTtc),
          status: q.status,
          date: q.issuedAt ?? q.createdAt?.slice(0, 10) ?? "",
          modulepart: "propale",
          tenantSlug,
        })),
      ];

      docs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

      return Response.json(docs, { headers: NO_STORE });
    }

    // dolibarr (legacy) — flow inchangé
    const [tps, invoices, proposals] = await Promise.all([
      getThirdParties(100, tenant).catch(() => []),
      getInvoices(200, tenant).catch(() => []),
      getProposals(200, tenant).catch(() => []),
    ]);

    const clientNameById: Record<string, string> = {};
    for (const t of tps) clientNameById[t.id] = t.name_alias || t.name;

    const docs = [
      ...invoices.map((inv) => ({
        id: `inv-${tenantSlug}-${inv.id}`,
        type: "facture" as const,
        ref: inv.ref,
        dolibarrId: inv.id,
        clientName: clientNameById[inv.socid] || "—",
        totalTTC: parseFloat(inv.total_ttc || "0"),
        status: inv.paye === "1" ? "paid" : inv.status === "0" ? "draft" : "sent",
        date: inv.date
          ? new Date(typeof inv.date === "number" ? inv.date * 1000 : inv.date)
              .toISOString()
              .slice(0, 10)
          : "",
        modulepart: "facture",
        tenantSlug,
      })),
      ...proposals.map((prop) => {
        const statusMap: Record<string, string> = {
          "0": "draft",
          "1": "validated",
          "2": "signed",
          "3": "refused",
          "4": "billed",
        };
        return {
          id: `prop-${tenantSlug}-${prop.id}`,
          type: "devis" as const,
          ref: prop.ref,
          dolibarrId: prop.id,
          clientName: clientNameById[prop.socid] || "—",
          totalTTC: parseFloat(prop.total_ttc || "0"),
          status: statusMap[prop.statut] || "draft",
          date: prop.date
            ? new Date(typeof prop.date === "number" ? prop.date * 1000 : prop.date)
                .toISOString()
                .slice(0, 10)
            : "",
          modulepart: "propale",
          tenantSlug,
        };
      }),
    ];

    docs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    return Response.json(docs, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
    if (e instanceof BusinessClientError) {
      return Response.json(
        { error: e.code, message: e.message },
        { status: e.status, headers: NO_STORE },
      );
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur CRM" },
      { status: 502, headers: NO_STORE }
    );
  }
}
