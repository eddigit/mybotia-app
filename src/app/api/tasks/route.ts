import {
  getTasks,
  getProjects,
  getThirdParties,
  createTask,
  updateTask,
  getTaskContacts,
  addTaskContact,
  getUserByEmail,
  type TenantConfig,
} from "@/lib/dolibarr";
import { getSession, getSessionTenants } from "@/lib/session";

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

    const session = await getSession();
    const tenants = await getSessionTenants();

    const allTasks: Array<{ task: any; tenant: TenantConfig }> = [];
    const allProjects: any[] = [];

    for (const tenant of tenants) {
      const [tasks, projects] = await Promise.all([
        getTasks(
          200,
          tenant,
          todayOnly ? { dueBeforeOrEqual: todayISO(), notDoneOnly: true } : {}
        ).catch(() => []),
        getProjects(200, tenant).catch(() => []),
      ]);
      for (const t of tasks) allTasks.push({ task: t, tenant });
      allProjects.push(...projects);
    }

    // Filter by current user as TASKEXECUTIVE when requested
    let filteredTasks = allTasks;
    if (mineOnly && session?.email) {
      // Resolve Dolibarr user per tenant (id differs per instance)
      const userByTenantUrl = new Map<string, string | null>();
      for (const tenant of tenants) {
        const u = await getUserByEmail(session.email, tenant).catch(() => null);
        userByTenantUrl.set(tenant.url, u?.id ?? null);
      }
      const keep: typeof allTasks = [];
      await Promise.all(
        allTasks.map(async ({ task, tenant }) => {
          const uid = userByTenantUrl.get(tenant.url);
          if (!uid) return;
          const contacts = await getTaskContacts(task.id, tenant).catch(() => []);
          const assigned = contacts.some(
            (c) =>
              c.code === "TASKEXECUTIVE" &&
              c.source === "internal" &&
              String(c.id) === String(uid)
          );
          if (assigned) keep.push({ task, tenant });
        })
      );
      filteredTasks = keep;
    }

    const projectById: Record<
      string,
      { ref: string; title: string; socid: string }
    > = {};
    for (const p of allProjects) {
      projectById[p.id] = { ref: p.ref, title: p.title, socid: p.socid };
    }

    const today = todayISO();
    const tasks = filteredTasks.map(({ task: t }) => {
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
          progress >= 100
            ? "done"
            : progress > 0
              ? "in_progress"
              : ("todo" as string),
        priority:
          t.priority === "2"
            ? "high"
            : t.priority === "1"
              ? "medium"
              : ("low" as string),
        progress,
        projectId: t.fk_project,
        projectName: proj?.title || "",
        projectRef: proj?.ref || "",
        dueDate,
        overdue: dueDate ? dueDate < today && progress < 100 : false,
        createdAt: t.datec || "",
      };
    });

    return Response.json(tasks);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    const body = await request.json();

    if (!body.label || !body.fk_project) {
      return Response.json(
        { error: "label et fk_project sont requis" },
        { status: 400 }
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
      session?.tenant
    );

    // Auto-assign current user as TASKEXECUTIVE so "mine=1" view picks it up
    if (session?.email && session.tenant && newId) {
      const user = await getUserByEmail(session.email, session.tenant).catch(() => null);
      if (user?.id) {
        await addTaskContact(String(newId), user.id, session.tenant).catch(() => null);
      }
    }

    return Response.json({ id: newId }, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur creation tache" },
      { status: 502 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) {
      return Response.json({ error: "id requis" }, { status: 400 });
    }
    await updateTask(id, data, session?.tenant);
    return Response.json({ success: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur mise a jour tache" },
      { status: 502 }
    );
  }
}
