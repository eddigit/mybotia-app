import { getProjects, getThirdParties } from "@/lib/dolibarr";
import { mapDolibarrProject } from "@/lib/mappers";

export async function GET() {
  try {
    const [doliProjects, thirdparties] = await Promise.all([
      getProjects(),
      getThirdParties(),
    ]);

    const clientNameById: Record<string, string> = {};
    for (const tp of thirdparties) {
      clientNameById[tp.id] = tp.name_alias || tp.name;
    }

    const projects = doliProjects.map((dp, i) =>
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
