import { getProjects } from "@/lib/dolibarr";
import { mapDolibarrProject } from "@/lib/mappers";

export async function GET() {
  try {
    const doliProjects = await getProjects();
    const projects = doliProjects.map((dp, i) => mapDolibarrProject(dp, i));
    return Response.json(projects);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502 }
    );
  }
}
