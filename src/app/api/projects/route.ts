import { getProjects, getThirdParties, createProject, validateProject } from "@/lib/dolibarr";
import { getSession, getSessionTenants } from "@/lib/session";
import { mapDolibarrProject } from "@/lib/mappers";

export async function GET() {
  try {
    const tenants = await getSessionTenants();

    const clientNameById: Record<string, string> = {};
    const allProjects = [];

    for (const tenant of tenants) {
      const [tp, proj] = await Promise.all([
        getThirdParties(100, tenant).catch(() => []),
        getProjects(100, tenant).catch(() => []),
      ]);
      for (const t of tp) {
        clientNameById[t.id] = t.name_alias || t.name;
      }
      allProjects.push(...proj);
    }

    const projects = allProjects.map((dp, i) =>
      mapDolibarrProject(dp, i, clientNameById[dp.socid])
    );

    return Response.json(projects);
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

    if (!body.title || !body.ref) {
      return Response.json(
        { error: "title et ref sont requis" },
        { status: 400 }
      );
    }

    const newId = await createProject({
      ref: body.ref,
      title: body.title,
      socid: body.socid || "",
      description: body.description || "",
      date_start: body.date_start || "",
      date_end: body.date_end || "",
      budget_amount: body.budget_amount || "",
      usage_task: 1,
      usage_opportunity: body.opp_amount ? 1 : 0,
      opp_amount: body.opp_amount || "",
      opp_percent: body.opp_percent || "",
    }, session?.tenant);

    try {
      await validateProject(String(newId), session?.tenant);
    } catch {
      // Project created but not validated — still usable
    }

    return Response.json({ id: newId }, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur creation projet" },
      { status: 502 }
    );
  }
}
