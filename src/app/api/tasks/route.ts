import {
  getTasks,
  getProjects,
  getThirdParties,
  createTask,
  updateTask,
} from "@/lib/dolibarr";
import { getSession, getSessionTenants } from "@/lib/session";

export async function GET() {
  try {
    const tenants = await getSessionTenants();

    const allTasks = [];
    const allProjects = [];

    for (const tenant of tenants) {
      const [tasks, projects] = await Promise.all([
        getTasks(200, tenant).catch(() => []),
        getProjects(200, tenant).catch(() => []),
      ]);
      allTasks.push(...tasks);
      allProjects.push(...projects);
    }

    const projectById: Record<
      string,
      { ref: string; title: string; socid: string }
    > = {};
    for (const p of allProjects) {
      projectById[p.id] = { ref: p.ref, title: p.title, socid: p.socid };
    }

    const tasks = allTasks.map((t) => {
      const proj = projectById[t.fk_project];
      const progress = parseFloat(t.progress || "0");
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
        dueDate: t.date_end
          ? new Date(
              typeof t.date_end === "number"
                ? t.date_end * 1000
                : t.date_end
            )
              .toISOString()
              .slice(0, 10)
          : undefined,
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

    const newId = await createTask({
      label: body.label,
      fk_project: body.fk_project,
      description: body.description || "",
      date_start: body.date_start || "",
      date_end: body.date_end || "",
      priority: body.priority || "0",
    }, session?.tenant);

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
