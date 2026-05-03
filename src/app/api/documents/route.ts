// Bloc 5G — /api/documents verrouillé sur le cockpit hostname.

import { getInvoices, getProposals, getThirdParties } from "@/lib/dolibarr";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export async function GET(request: Request) {
  try {
    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }
    const { tenant, slug: tenantSlug } = cockpit;

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
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502, headers: NO_STORE }
    );
  }
}
