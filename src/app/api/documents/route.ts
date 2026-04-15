import {
  getInvoices,
  getProposals,
  getThirdParties,
  getThirdPartiesByCategory,
  getThirdParty,
} from "@/lib/dolibarr";
import { getTenantScope } from "@/lib/tenant";

export async function GET() {
  try {
    const scope = await getTenantScope();

    // Get thirdparties according to tenant scope
    let thirdparties;
    if (scope.isSuperadmin) {
      thirdparties = await getThirdParties();
    } else if (scope.categoryId) {
      thirdparties = await getThirdPartiesByCategory(scope.categoryId);
    } else if (scope.thirdpartyIds) {
      thirdparties = await Promise.all(
        scope.thirdpartyIds.map((id) => getThirdParty(id))
      );
    } else {
      thirdparties = await getThirdParties();
    }

    const allowedSocids = new Set(thirdparties.map((tp) => tp.id));
    const clientNameById: Record<string, string> = {};
    for (const tp of thirdparties) {
      clientNameById[tp.id] = tp.name_alias || tp.name;
    }

    const [invoices, proposals] = await Promise.all([
      getInvoices(200),
      getProposals(200),
    ]);

    // Filter by tenant
    const filteredInvoices = scope.isSuperadmin
      ? invoices
      : invoices.filter((inv) => allowedSocids.has(inv.socid));
    const filteredProposals = scope.isSuperadmin
      ? proposals
      : proposals.filter((prop) => allowedSocids.has(prop.socid));

    const docs = [
      ...filteredInvoices.map((inv) => ({
        id: `inv-${inv.id}`,
        type: "facture" as const,
        ref: inv.ref,
        dolibarrId: inv.id,
        clientName: clientNameById[inv.socid] || "—",
        totalTTC: parseFloat(inv.total_ttc || "0"),
        status:
          inv.paye === "1" ? "paid" : inv.status === "0" ? "draft" : "sent",
        date: inv.date
          ? new Date(
              typeof inv.date === "number" ? inv.date * 1000 : inv.date
            )
              .toISOString()
              .slice(0, 10)
          : "",
        modulepart: "facture",
      })),
      ...filteredProposals.map((prop) => {
        const statusMap: Record<string, string> = {
          "0": "draft",
          "1": "validated",
          "2": "signed",
          "3": "refused",
          "4": "billed",
        };
        return {
          id: `prop-${prop.id}`,
          type: "devis" as const,
          ref: prop.ref,
          dolibarrId: prop.id,
          clientName: clientNameById[prop.socid] || "—",
          totalTTC: parseFloat(prop.total_ttc || "0"),
          status: statusMap[prop.statut] || "draft",
          date: prop.date
            ? new Date(
                typeof prop.date === "number"
                  ? prop.date * 1000
                  : prop.date
              )
                .toISOString()
                .slice(0, 10)
            : "",
          modulepart: "propale",
        };
      }),
    ];

    // Sort by date descending
    docs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    return Response.json(docs);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502 }
    );
  }
}
