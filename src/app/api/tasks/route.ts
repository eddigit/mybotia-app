// Bloc 5G — /api/tasks verrouillé sur le cockpit hostname.
// GET/POST/PUT : un cockpit = un tenant. Plus d'agrégation multi-tenant.
//
// V1.1.B Phase 1 : GET passe par crm-router. POST/PUT inchangés (Phase 2).
// V1.1.B Phase 1.1.A : log JSON `crm_route` à chaque sortie GET.

import crypto from "node:crypto";

import {
  getTasks,
  getProjects,
  createTask,
  updateTask,
  getTaskContacts,
  addTaskContact,
  getUserByEmail,
} from "@/lib/dolibarr";
import { getSession } from "@/lib/session";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";
import {
  getCrmProvider,
  CrmRouterError,
  crmRouterErrorResponse,
  logCrmRoute,
} from "@/lib/crm-router";
import {
  businessGetJson,
  businessSendJson,
  BusinessClientError,
} from "@/lib/business-client";
import {
  mapBusinessTaskToCockpit,
  mapInputTaskFromUi,
  isEmptyInput,
  type BusinessTask,
  type BusinessProject,
} from "@/lib/business-mappers";
import { taskAssigneeFromContacts } from "@/lib/task-assignees";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;
const ROUTE = "/api/tasks";

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  let tenantId: string | null = null;
  let tenantSlug = "?";
  let providerKind: string | null = null;
  let status = 200;
  let errorCode: string | null = null;
  let response: Response;

  try {
    const featureCheck = await requireFeature(request, "tasks");
    if (!featureCheck.ok) {
      response = featureCheck.response;
      status = response.status;
      errorCode = "feature_disabled";
      return response;
    }

    const url = new URL(request.url);
    const todayOnly = url.searchParams.get("today") === "1";
    const mineOnly = url.searchParams.get("mine") === "1";
    // V1.1.C — filter projectId server-side (avant : ignoré → tout le tenant
    // remontait, le drill-down filtrait côté client). On valide format UUID
    // pour ne pas envoyer n'importe quoi à business.
    const projectIdRaw = url.searchParams.get("projectId");
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const projectIdFilter =
      projectIdRaw && UUID_RE.test(projectIdRaw) ? projectIdRaw : null;

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      status = cockpit.status;
      errorCode = "cockpit_refused";
      response = Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
      return response;
    }
    const { tenant, slug } = cockpit;
    tenantSlug = slug;

    const session = await getSession();
    if (!session) {
      status = 401;
      errorCode = "no_session";
      response = Response.json({ error: "Non authentifie" }, { status: 401, headers: NO_STORE });
      return response;
    }

    const provider = await getCrmProvider(tenantSlug);
    tenantId = provider.tenantId;
    providerKind = provider.kind;

    if (provider.kind === "external") {
      status = 501;
      errorCode = "crm_provider_not_configured";
      response = Response.json(
        { error: errorCode, tenant: tenantSlug },
        { status, headers: NO_STORE },
      );
      return response;
    }

    if (provider.kind === "mybotia_business") {
      const claims = {
        tenantId: provider.tenantId,
        tenantSlug,
        scopes: ["crm:read"] as const,
      };
      // V1.1.C — propager filtre projectId au business (lit `project_id`
      // côté GET /api/v1/tasks).
      const tasksPath = projectIdFilter
        ? `/api/v1/tasks?project_id=${encodeURIComponent(projectIdFilter)}`
        : "/api/v1/tasks";
      const [tasksBz, projectsBz] = await Promise.all([
        businessGetJson<BusinessTask[]>(tasksPath, claims),
        businessGetJson<BusinessProject[]>("/api/v1/projects", claims),
      ]);
      const projectNameById: Record<string, string> = {};
      for (const p of projectsBz) projectNameById[p.id] = p.name;

      const today = todayISO();
      let mapped = tasksBz.map((t) => {
        const base = mapBusinessTaskToCockpit(t, projectNameById[t.projectId]);
        return {
          ...base,
          progress:
            base.status === "done" ? 100 : base.status === "in_progress" ? 50 : 0,
          projectRef: "",
          tenantSlug,
          overdue: base.dueDate ? base.dueDate < today && base.status !== "done" : false,
        };
      });
      if (todayOnly) {
        mapped = mapped.filter(
          (t) =>
            t.status !== "done" &&
            t.dueDate !== undefined &&
            t.dueDate <= todayISO(),
        );
      }
      // mineOnly côté business V1 : pas de notion d'assignment user → on
      // retourne tout pour le user courant (cockpit mybotia = Gilles).
      response = Response.json(mapped, { headers: NO_STORE });
      return response;
    }

    // dolibarr (legacy) — flow inchangé.
    // V1.1.B Phase 1.1.D : pas de .catch(() => []) sur la liste principale.
    // Une panne Dolibarr → 502 + log crm_route avec error_code, au lieu
    // d'un "0 tâche" silencieux qui masque l'incident provider.
    // Les enrichissements (`getUserByEmail`, `getTaskContacts`) gardent
    // leur .catch(() => null/[]) car ils sont optionnels (assignment).
    const [tasksRaw, projects] = await Promise.all([
      getTasks(
        200,
        tenant,
        todayOnly ? { dueBeforeOrEqual: todayISO(), notDoneOnly: true } : {}
      ),
      getProjects(200, tenant),
    ]);

    type Task = (typeof tasksRaw)[number];
    // V1.1.C — filter projectId server-side aussi côté legacy Dolibarr.
    // Le filtre client-side existait déjà sur la page mais on garde la
    // sémantique d'API cohérente entre les 2 providers.
    let filteredTasks: Task[] = projectIdFilter
      ? tasksRaw.filter((t) => String(t.fk_project) === projectIdFilter)
      : tasksRaw;
    if (mineOnly && session.email) {
      const u = await getUserByEmail(session.email, tenant).catch(() => null);
      if (!u?.id) {
        filteredTasks = [];
      } else {
        const uid = String(u.id);
        const keep: Task[] = [];
        await Promise.all(
          tasksRaw.map(async (task) => {
            if (task.fk_user_creat && String(task.fk_user_creat) === uid) {
              keep.push(task);
              return;
            }
            const contacts = await getTaskContacts(task.id, tenant).catch(() => []);
            const assigned = contacts.some(
              (c) =>
                c.code === "TASKEXECUTIVE" &&
                c.source === "internal" &&
                String(c.id) === uid
            );
            if (assigned) keep.push(task);
          })
        );
        filteredTasks = keep;
      }
    }

    const projectById: Record<string, { ref: string; title: string; socid: string }> = {};
    for (const p of projects) projectById[p.id] = { ref: p.ref, title: p.title, socid: p.socid };

    const contactsByTaskId = new Map(
      await Promise.all(
        filteredTasks.map(async (task) => [
          task.id,
          await getTaskContacts(task.id, tenant).catch(() => []),
        ] as const)
      )
    );

    const today = todayISO();
    const tasks = filteredTasks.map((t) => {
      const proj = projectById[t.fk_project];
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
          progress >= 100 ? "done" : progress > 0 ? "in_progress" : "todo",
        priority:
          t.priority === "2" ? "high" : t.priority === "1" ? "medium" : "low",
        progress,
        projectId: t.fk_project,
        projectName: proj?.title || "",
        projectRef: proj?.ref || "",
        assigneeId: assignee.assigneeId,
        assigneeName: assignee.assigneeName,
        assigneeEmail: assignee.assigneeEmail,
        clientId: proj?.socid || undefined,
        tenantSlug,
        dueDate,
        overdue: dueDate ? dueDate < today && progress < 100 : false,
        createdAt: t.datec || "",
      };
    });

    response = Response.json(tasks, { headers: NO_STORE });
    return response;
  } catch (e) {
    if (e instanceof CrmRouterError) {
      status = e.status;
      errorCode = e.code;
      response = crmRouterErrorResponse(e);
      return response;
    }
    if (e instanceof BusinessClientError) {
      status = e.status;
      errorCode = e.code;
      response = Response.json(
        { error: e.code, message: e.message },
        { status: e.status, headers: NO_STORE },
      );
      return response;
    }
    status = 502;
    errorCode = e instanceof Error ? e.name : "UnknownError";
    response = Response.json(
      { error: e instanceof Error ? e.message : "Erreur CRM" },
      { status: 502, headers: NO_STORE }
    );
    return response;
  } finally {
    logCrmRoute({
      evt: "crm_route",
      request_id: requestId,
      tenant_id: tenantId,
      tenant_slug: tenantSlug,
      route: ROUTE,
      crm_provider: providerKind,
      source: providerKind,
      status,
      duration_ms: Date.now() - startedAt,
      error_code: errorCode,
    });
  }
}

export async function POST(request: Request) {
  try {
    const featureCheck = await requireFeature(request, "tasks");
    if (!featureCheck.ok) return featureCheck.response;

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }
    const { tenant } = cockpit;

    const provider = await getCrmProvider(cockpit.slug);

    const session = await getSession();
    const body = await request.json();

    if (provider.kind === "external") {
      return Response.json(
        { error: "crm_provider_not_configured", tenant: cockpit.slug },
        { status: 501, headers: NO_STORE },
      );
    }

    if (provider.kind === "mybotia_business") {
      // V1.1.B Phase 2 A2 — mapping minimal Dolibarr→business via helper.
      const input = mapInputTaskFromUi(body);
      if (!input.title || !input.projectId) {
        return Response.json(
          {
            error: "missing_required_fields",
            required: ["title (or label)", "projectId (or fk_project as UUID)"],
          },
          { status: 400, headers: NO_STORE },
        );
      }
      const businessBody = {
        projectId: input.projectId,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? "todo",
        dueDate: input.dueDate ?? null,
        // V1.1.B agence digitale
        priority: input.priority ?? null,
        assignedTo: input.assignedTo ?? null,
        category: input.category ?? null,
        workflowStep: input.workflowStep ?? null,
        githubIssueUrl: input.githubIssueUrl ?? null,
        githubPrUrl: input.githubPrUrl ?? null,
        vercelDeploymentUrl: input.vercelDeploymentUrl ?? null,
        whatsappThreadRef: input.whatsappThreadRef ?? null,
      };
      const created = await businessSendJson<{ id: string; title: string; status: string }>(
        "POST",
        "/api/v1/tasks",
        businessBody,
        {
          tenantId: provider.tenantId,
          tenantSlug: cockpit.slug,
          scopes: ["crm:read", "crm:write"],
        },
      );
      return Response.json(
        { id: created.id, tenant_slug: cockpit.slug, title: created.title },
        { status: 201, headers: NO_STORE },
      );
    }

    // dolibarr (legacy) — flow inchangé
    if (!body.label || !body.fk_project) {
      return Response.json(
        { error: "label et fk_project sont requis" },
        { status: 400, headers: NO_STORE }
      );
    }

    const newId = await createTask(
      {
        label: body.label,
        fk_project: body.fk_project,
        description: body.description || "",
        date_start: body.date_start || "",
        date_end: body.date_end || "",
        priority: body.priority || "0",
      },
      tenant
    );

    if (session?.email && newId) {
      const u = await getUserByEmail(session.email, tenant).catch(() => null);
      if (u?.id) {
        await addTaskContact(String(newId), u.id, tenant).catch(() => null);
      }
    }

    return Response.json(
      { id: newId, tenant_slug: cockpit.slug },
      { status: 201, headers: NO_STORE }
    );
  } catch (e) {
    if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
    if (e instanceof BusinessClientError) {
      return Response.json(
        { error: e.code, message: e.message },
        { status: e.status, headers: NO_STORE },
      );
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur creation tache" },
      { status: 502, headers: NO_STORE }
    );
  }
}

// Legacy — conservé pour compat. Le drawer Bloc 5D utilise PATCH /api/tasks/[id].
export async function PUT(request: Request) {
  try {
    const featureCheck = await requireFeature(request, "tasks");
    if (!featureCheck.ok) return featureCheck.response;

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }
    const body = await request.json();
    const { id, tenant_slug: _, ...data } = body as Record<string, unknown>;
    if (!id) {
      return Response.json({ error: "id requis" }, { status: 400, headers: NO_STORE });
    }
    await updateTask(String(id), data, cockpit.tenant);
    return Response.json(
      { success: true, tenant_slug: cockpit.slug },
      { headers: NO_STORE }
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur mise a jour tache" },
      { status: 502, headers: NO_STORE }
    );
  }
}
