import {
  getProjects,
  getThirdParties,
  getThirdPartiesByCategory,
  getThirdParty,
  createProject,
  validateProject,
} from "@/lib/dolibarr";
import { mapDolibarrProject } from "@/lib/mappers";
import { getTenantScope } from "@/lib/tenant";

export async function GET() {
  try {
    const scope = await getTenantScope();

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
    const clientNameById: Record<string, string> = {};
    for (const tp of thirdparties) {
      clientNameById[tp.id] = tp.name_alias || tp.name;
    }

    const doliProjects = await getProjects();
    const filteredProjects = scope.isSuperadmin
      ? doliProjects
      : doliProjects.filter((dp) => allowedSocids.has(dp.socid));

    const projects = filteredProjects.map((dp, i) =>
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
    });

    // Auto-validate project
    try {
      await validateProject(String(newId));
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
