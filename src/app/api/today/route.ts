// Bloc 5G — /api/today verrouillé sur le cockpit hostname.
// V1.1.B Phase 3A anti-hybride silencieux : si crm_provider=mybotia_business,
// /today agrège exclusivement les données business.

import {
  getThirdParties,
  getProjects,
  getInvoices,
  getProposals,
  getEvents,
  getTasks,
  getTaskContacts,
} from "@/lib/dolibarr";
import {
  mapProjectToDeal,
  mapEventToActivity,
  mapProposal,
  mapInvoice,
} from "@/lib/mappers";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { getCockpitFeatures } from "@/lib/tenant-features";
import {
  getCrmProvider,
  CrmRouterError,
  crmRouterErrorResponse,
} from "@/lib/crm-router";
import { businessGetJson, BusinessClientError } from "@/lib/business-client";
import {
  type BusinessClient,
  type BusinessProject,
  type BusinessTask,
} from "@/lib/business-mappers";
import { taskAssigneeFromContacts } from "@/lib/task-assignees";

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
    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }
    const { tenant, slug: tenantSlug } = cockpit;

    const provider = await getCrmProvider(tenantSlug);

    // V1.1.B Phase 3A — branche business-first
    if (provider.kind === "mybotia_business") {
      const claims = {
        tenantId: provider.tenantId,
        tenantSlug,
        scopes: ["crm:read"] as const,
      };
      const [bizClients, bizProjects, bizTasks, bizQuotes, bizInvoices] = await Promise.all([
        businessGetJson<BusinessClient[]>("/api/v1/clients", claims),
        businessGetJson<BusinessProject[]>("/api/v1/projects", claims),
        businessGetJson<BusinessTask[]>("/api/v1/tasks", claims),
        businessGetJson<BusinessQuoteRow[]>("/api/v1/quotes", claims).catch(() => []),
        businessGetJson<BusinessInvoiceRow[]>("/api/v1/invoices", claims).catch(() => []),
      ]);

      const today = new Date().toISOString().slice(0, 10);
      const projectById: Record<string, BusinessProject> = {};
      for (const p of bizProjects) projectById[p.id] = p;
      const clientNameById: Record<string, string> = {};
      for (const c of bizClients) clientNameById[c.id] = c.name;

      const tasks = bizTasks.map((t) => {
        const proj = projectById[t.projectId];
        const progress = t.status === "done" ? 100 : t.status === "in_progress" ? 50 : 0;
        return {
          id: t.id,
          title: t.title,
          description: t.description ?? undefined,
          status: (t.status === "cancelled" ? "todo" : t.status) as string,
          priority: (t.priority === "urgent" ? "high" : (t.priority ?? "low")) as string,
          progress,
          projectId: t.projectId,
          projectName: proj?.name ?? "",
          projectRef: "",
          tenantSlug,
          dueDate: t.dueDate ?? undefined,
          overdue: !!(t.dueDate && t.dueDate < today && t.status !== "done"),
          createdAt: t.createdAt,
        };
      });

      return Response.json(
        {
          tenant: tenantSlug,
          tasks,
          deals: [], // business V1 n'a pas de pipeline opp_status
          proposals: bizQuotes.map((q) => ({
            id: q.id,
            ref: q.reference,
            total: safeNumber(q.totalTtc),
            status: q.status,
            date: q.issuedAt ?? q.createdAt?.slice(0, 10) ?? "",
            expiryDate: "",
            clientId: q.clientId,
            clientName: clientNameById[q.clientId],
            tenantSlug,
          })),
          invoices: bizInvoices.map((inv) => ({
            id: inv.id,
            ref: inv.reference,
            total: safeNumber(inv.totalTtc),
            status:
              inv.status === "paid"
                ? "paid"
                : inv.status === "draft"
                  ? "draft"
                  : "sent",
            date: inv.issuedAt ?? inv.createdAt?.slice(0, 10) ?? "",
            clientId: inv.clientId,
            clientName: clientNameById[inv.clientId],
            tenantSlug,
          })),
          activities: [],
          source: "mybotia_business",
          partial: true,
          missingFeatures: ["deals_pipeline", "activities_events"],
        },
        { headers: NO_STORE },
      );
    }

    if (provider.kind === "external") {
      return Response.json(
        {
          error: "crm_provider_not_configured",
          tenant: tenantSlug,
          tasks: [],
          deals: [],
          proposals: [],
          invoices: [],
          activities: [],
          partial: true,
        },
        { status: 501, headers: NO_STORE },
      );
    }

    // dolibarr (legacy) — flow inchangé
    // Bloc 6B — soft feature gate : /today reste accessible, sections filtrées.
    const { features } = await getCockpitFeatures(request);
    const fCrm = features.crm === true;
    const fPipeline = features.pipeline === true;
    const fDocs = features.documents === true;
    const fTasks = features.tasks === true;

    const [tps, projects, invoices, proposals, events, tasks] = await Promise.all([
      fCrm ? getThirdParties(200, tenant).catch(() => []) : Promise.resolve([]),
      fPipeline ? getProjects(200, tenant).catch(() => []) : Promise.resolve([]),
      fDocs ? getInvoices(100, tenant).catch(() => []) : Promise.resolve([]),
      fDocs ? getProposals(100, tenant).catch(() => []) : Promise.resolve([]),
      getEvents(200, tenant).catch(() => []),
      fTasks ? getTasks(200, tenant).catch(() => []) : Promise.resolve([]),
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

    const contactsByTaskId = new Map(
      await Promise.all(
        tasks.map(async (task) => [
          task.id,
          await getTaskContacts(task.id, tenant).catch(() => []),
        ] as const)
      )
    );

    const mappedTasks = tasks.map((t) => {
      const proj = projectByIdFull[t.fk_project];
      const assignee = taskAssigneeFromContacts(contactsByTaskId.get(t.id) || []);
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
        assigneeId: assignee.assigneeId,
        assigneeName: assignee.assigneeName,
        assigneeEmail: assignee.assigneeEmail,
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
