import { getProjectMemory, saveProjectMemory } from "@/lib/claude-bridge";
import { getProject } from "@/lib/dolibarr";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await getProject(id);
    const memory = await getProjectMemory(project.ref);
    return Response.json({
      projectId: id,
      projectRef: project.ref,
      projectName: project.title,
      memory: memory || "",
      hasMemory: !!memory,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await getProject(id);
    const body = await request.json();

    if (typeof body.memory !== "string") {
      return Response.json(
        { error: "memory (string) requis" },
        { status: 400 }
      );
    }

    await saveProjectMemory(project.ref, body.memory);
    return Response.json({ success: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur" },
      { status: 500 }
    );
  }
}
