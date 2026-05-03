// Bloc 5G — /api/today verrouillé sur le cockpit hostname.
//   app.mybotia.com/today      → tenant=mybotia
//   vlmedical.mybotia.com/today → tenant=vlmedical (futur)
//   etc.
//
// Plus de fallback FORCED_TENANT hardcodé. Le hostname est l'unique source.

import {
  getThirdParties,
  getProjects,
  getInvoices,
  getProposals,
  getEvents,
  getTasks,
} from "@/lib/dolibarr";
import {
  mapProjectToDeal,
  mapEventToActivity,
  mapProposal,
  mapInvoice,
} from "@/lib/mappers";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export async function GET(request: Request) {
  try {
    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }
    const { tenant, slug: tenantSlug } = cockpit;

    const [tps, projects, invoices, proposals, events, tasks] = await Promise.all([
      getThirdParties(200, tenant).catch(() => []),
      getProjects(200, tenant).catch(() => []),
      getInvoices(100, tenant).catch(() => []),
      getProposals(100, tenant).catch(() => []),
      getEvents(200, tenant).catch(() => []),
      getTasks(200, tenant).catch(() => []),
    ]);

    const clientNameById: Record<string, string> = {};
    for (const tp of tps) clientNameById[tp.id] = tp.name_alias || tp.name;

    const dealsRaw = projects.map((dp) =>
      mapProjectToDeal(dp, clientNameById[dp.socid] || "", tenantSlug)
    );
    const deals = dealsRaw.filter((d): d is NonNullable<typeof d> => d !== null);

    const mappedProposals = proposals.map((p) =>
      mapProposal(p, tenantSlug, clientNameById[p.socid])
    );
    const mappedInvoices = invoices.map((inv) =>
      mapInvoice(inv, tenantSlug, clientNameById[inv.socid])
    );

    const projectTitleById: Record<string, string> = {};
    for (const p of projects) projectTitleById[p.id] = p.title || p.ref || "";

    const manualEvents = events.filter((e) => e.type_code !== "AC_OTH_AUTO");
    const autoEvents = events.filter((e) => e.type_code === "AC_OTH_AUTO");
    const sortedEvents = [...manualEvents, ...autoEvents].slice(0, 30);

    const activities = sortedEvents.map((e) =>
      mapEventToActivity(e, clientNameById, projectTitleById, undefined, tenantSlug)
    );

    const today = new Date().toISOString().slice(0, 10);
    const projectByIdFull: Record<string, { ref: string; title: string }> = {};
    for (const p of projects) projectByIdFull[p.id] = { ref: p.ref, title: p.title };

    const mappedTasks = tasks.map((t) => {
      const proj = projectByIdFull[t.fk_project];
      const progress = parseFloat(t.progress || "0");
      const dueRaw = t.date_end;
      const dueDate = dueRaw
        ? new Date(typeof dueRaw === "number" ? dueRaw * 1000 : dueRaw)
            .toISOString()
            .slice(0, 10)
        : undefined;
      return {
        id: t.id,
        title: t.label,
        description: t.description || undefined,
        status:
          progress >= 100 ? "done" : progress > 0 ? "in_progress" : ("todo" as string),
        priority:
          t.priority === "2" ? "high" : t.priority === "1" ? "medium" : ("low" as string),
        progress,
        projectId: t.fk_project,
        projectName: proj?.title || "",
        projectRef: proj?.ref || "",
        tenantSlug,
        dueDate,
        overdue: dueDate ? dueDate < today && progress < 100 : false,
        createdAt: t.datec || "",
      };
    });

    return Response.json(
      {
        tenant: tenantSlug,
        tasks: mappedTasks,
        deals,
        proposals: mappedProposals,
        invoices: mappedInvoices,
        activities,
      },
      { headers: NO_STORE }
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502, headers: NO_STORE }
    );
  }
}
