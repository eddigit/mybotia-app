import { getInvoices, getProposals, getThirdParties } from "@/lib/dolibarr";
import { getSessionTenants } from "@/lib/session";

export async function GET() {
  try {
    const tenants = await getSessionTenants();

    const allInvoices = [];
    const allProposals = [];
    const clientNameById: Record<string, string> = {};

    for (const tenant of tenants) {
      const [tp, inv, prop] = await Promise.all([
        getThirdParties(100, tenant).catch(() => []),
        getInvoices(200, tenant).catch(() => []),
        getProposals(200, tenant).catch(() => []),
      ]);
      for (const t of tp) {
        clientNameById[t.id] = t.name_alias || t.name;
      }
      allInvoices.push(...inv);
      allProposals.push(...prop);
    }

    const docs = [
      ...allInvoices.map((inv) => ({
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
      ...allProposals.map((prop) => {
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
                typeof prop.date === "number" ? prop.date * 1000 : prop.date
              )
                .toISOString()
                .slice(0, 10)
            : "",
          modulepart: "propale",
        };
      }),
    ];

    docs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    return Response.json(docs);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502 }
    );
  }
}
