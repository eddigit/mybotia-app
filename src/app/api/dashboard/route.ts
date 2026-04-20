import { getThirdParties, getProjects, getInvoices, getEvents } from "@/lib/dolibarr";
import { getSession, getSessionTenants } from "@/lib/session";
import {
  mapThirdPartyToClient,
  mapDolibarrProject,
  mapProjectToDeal,
  mapEventToActivity,
  computeMetrics,
} from "@/lib/mappers";

export async function GET() {
  try {
    const session = await getSession();
    const tenants = await getSessionTenants();

    // Fetch data from ALL tenants the user has access to
    const allThirdparties = [];
    const allProjects = [];
    const allInvoices = [];
    const allEvents = [];

    for (const tenant of tenants) {
      const [tp, proj, inv, ev] = await Promise.all([
        getThirdParties(100, tenant).catch(() => []),
        getProjects(100, tenant).catch(() => []),
        getInvoices(50, tenant).catch(() => []),
        getEvents(200, tenant).catch(() => []),
      ]);
      allThirdparties.push(...tp);
      allProjects.push(...proj);
      allInvoices.push(...inv);
      allEvents.push(...ev);
    }

    const clients = allThirdparties.map(mapThirdPartyToClient);

    const clientNameById: Record<string, string> = {};
    for (const tp of allThirdparties) {
      clientNameById[tp.id] = tp.name_alias || tp.name;
    }

    const projects = allProjects.map((dp, i) =>
      mapDolibarrProject(dp, i, clientNameById[dp.socid])
    );

    const deals = allProjects
      .map((dp) => mapProjectToDeal(dp, clientNameById[dp.socid] || ""))
      .filter((d): d is NonNullable<typeof d> => d !== null);

    const manualEvents = allEvents.filter((e) => e.type_code !== "AC_OTH_AUTO");
    const autoEvents = allEvents.filter((e) => e.type_code === "AC_OTH_AUTO");
    const sortedEvents = [...manualEvents, ...autoEvents];

    const activities = sortedEvents
      .slice(0, 15)
      .map((e) => mapEventToActivity(e, clientNameById));

    const metrics = computeMetrics(clients, projects, deals, allInvoices);

    return Response.json({
      metrics,
      clients,
      projects,
      deals,
      activities,
      tenant: session?.tenantSlug || "mybotia",
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502 }
    );
  }
}
