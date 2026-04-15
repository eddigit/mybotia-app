import { getProject } from "@/lib/dolibarr";
import { mapDolibarrProject } from "@/lib/mappers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const dp = await getProject(id);
    const project = mapDolibarrProject(dp, 0);
    return Response.json(project);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502 }
    );
  }
}
