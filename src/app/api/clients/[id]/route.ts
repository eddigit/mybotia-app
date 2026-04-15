import { getThirdParty, getThirdPartyContacts, getThirdPartyEvents, getThirdPartyInvoices } from "@/lib/dolibarr";
import { mapThirdPartyToClient, mapEventToActivity } from "@/lib/mappers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const [tp, contacts, events, invoices] = await Promise.all([
      getThirdParty(id),
      getThirdPartyContacts(id),
      getThirdPartyEvents(id),
      getThirdPartyInvoices(id),
    ]);

    const client = mapThirdPartyToClient(tp);
    const activities = events
      .filter((e) => e.type_code !== "AC_OTH_AUTO")
      .slice(0, 10)
      .map(mapEventToActivity);

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
        status: inv.paye === "1" ? "paid" : inv.status === "0" ? "draft" : "sent",
      })),
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502 }
    );
  }
}
