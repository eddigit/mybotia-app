import {
  getThirdParty,
  getThirdPartyContacts,
  getThirdPartyEvents,
  getThirdPartyInvoices,
  getThirdPartyProposals,
  getThirdPartyProjects,
} from "@/lib/dolibarr";
import {
  mapThirdPartyToClient,
  mapEventToActivity,
  mapProposal,
  mapDolibarrProject,
} from "@/lib/mappers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const [tp, contacts, events, invoices, proposals, projects] =
      await Promise.all([
        getThirdParty(id),
        getThirdPartyContacts(id),
        getThirdPartyEvents(id),
        getThirdPartyInvoices(id),
        getThirdPartyProposals(id),
        getThirdPartyProjects(id),
      ]);

    const client = mapThirdPartyToClient(tp);

    // Prioritize manual events
    const manualEvents = events.filter((e) => e.type_code !== "AC_OTH_AUTO");
    const autoEvents = events.filter((e) => e.type_code === "AC_OTH_AUTO");
    const sortedEvents = [...manualEvents, ...autoEvents];

    const activities = sortedEvents.slice(0, 15).map((e) => mapEventToActivity(e));

    return Response.json({
      client,
      contacts: contacts.map((c) => ({
        id: c.id,
        name: `${c.firstname || ""} ${c.lastname || ""}`.trim(),
        email: c.email,
        phone: c.phone_pro || c.phone_mobile,
        role: c.poste,
      })),
      activities,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        ref: inv.ref,
        total: parseFloat(inv.total_ttc || "0"),
        status:
          inv.paye === "1" ? "paid" : inv.status === "0" ? "draft" : "sent",
        date: inv.date
          ? new Date(
              typeof inv.date === "number" ? inv.date * 1000 : inv.date
            )
              .toISOString()
              .slice(0, 10)
          : "",
      })),
      proposals: proposals.map(mapProposal),
      projects: projects.map((p, i) => mapDolibarrProject(p, i, client.name)),
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502 }
    );
  }
}
