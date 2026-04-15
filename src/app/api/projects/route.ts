import {
  getProjects,
  getThirdParties,
  getThirdPartiesByCategory,
  getThirdParty,
} from "@/lib/dolibarr";
import { mapDolibarrProject } from "@/lib/mappers";
import { getTenantScope } from "@/lib/tenant";

export async function GET() {
  try {
    const scope = await getTenantScope();

    // Get thirdparties according to tenant scope
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

    // Build allowed socid set and name lookup
    const allowedSocids = new Set(thirdparties.map((tp) => tp.id));
    const clientNameById: Record<string, string> = {};
    for (const tp of thirdparties) {
      clientNameById[tp.id] = tp.name_alias || tp.name;
    }

    // Fetch all projects, then filter by tenant's thirdparties
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
