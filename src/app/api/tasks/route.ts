// Bloc 5G — /api/tasks verrouillé sur le cockpit hostname.
// GET/POST/PUT : un cockpit = un tenant. Plus d'agrégation multi-tenant.

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

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const todayOnly = url.searchParams.get("today") === "1";
    const mineOnly = url.searchParams.get("mine") === "1";

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }
    const { tenant, slug: tenantSlug } = cockpit;

    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Non authentifie" }, { status: 401, headers: NO_STORE });
    }

    const [tasksRaw, projects] = await Promise.all([
      getTasks(
        200,
        tenant,
        todayOnly ? { dueBeforeOrEqual: todayISO(), notDoneOnly: true } : {}
      ).catch(() => []),
      getProjects(200, tenant).catch(() => []),
    ]);

    type Task = (typeof tasksRaw)[number];
    let filteredTasks: Task[] = tasksRaw;
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

    const today = todayISO();
    const tasks = filteredTasks.map((t) => {
      const proj = projectById[t.fk_project];
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
        clientId: proj?.socid || undefined,
        tenantSlug,
        dueDate,
        overdue: dueDate ? dueDate < today && progress < 100 : false,
        createdAt: t.datec || "",
      };
    });

    return Response.json(tasks, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502, headers: NO_STORE }
    );
  }
}

export async function POST(request: Request) {
  try {
    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }
    const { tenant } = cockpit;

    const session = await getSession();
    const body = await request.json();

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
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur creation tache" },
      { status: 502, headers: NO_STORE }
    );
  }
}

// Legacy — conservé pour compat. Le drawer Bloc 5D utilise PATCH /api/tasks/[id].
export async function PUT(request: Request) {
  try {
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
