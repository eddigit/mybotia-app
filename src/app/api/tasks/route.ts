import {
  getTasks,
  getProjects,
  getThirdParties,
  getThirdPartiesByCategory,
  getThirdParty,
  createTask,
  updateTask,
} from "@/lib/dolibarr";
import { getTenantScope } from "@/lib/tenant";

export async function GET() {
  try {
    const scope = await getTenantScope();

    // Get thirdparties for tenant scope
    let thirdparties;
    if (scope.isSuperadmin) {
      thirdparties = await getThirdParties();
    } else if (scope.categoryId) {
      thirdparties = await getThirdPartiesByCategory(scope.categoryId);
    } else if (scope.thirdpartyIds) {
      thirdparties = await Promise.all(
        scope.thirdpartyIds.map((id) => getThirdParty(id))
      );
    } else {
      thirdparties = await getThirdParties();
    }

    const allowedSocids = new Set(thirdparties.map((tp) => tp.id));

    // Get all tasks and projects
    const [doliTasks, doliProjects] = await Promise.all([
      getTasks(200),
      getProjects(200),
    ]);

    // Build project lookup
    const projectById: Record<
      string,
      { ref: string; title: string; socid: string }
    > = {};
    for (const p of doliProjects) {
      projectById[p.id] = { ref: p.ref, title: p.title, socid: p.socid };
    }

    // Filter tasks by tenant (through their project's socid)
    const filteredTasks = scope.isSuperadmin
      ? doliTasks
      : doliTasks.filter((task) => {
          const proj = projectById[task.fk_project];
          return proj && allowedSocids.has(proj.socid);
        });

    // Map to app format
    const tasks = filteredTasks.map((t) => {
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
    });

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
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) {
      return Response.json({ error: "id requis" }, { status: 400 });
    }
    await updateTask(id, data);
    return Response.json({ success: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur mise a jour tache" },
      { status: 502 }
    );
  }
}
