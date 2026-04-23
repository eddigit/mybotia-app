import { deleteFolder, renameFolder } from "@/lib/claude-bridge";
import { getSession } from "@/lib/session";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Non authentifie" }, { status: 401 });
    }
    const { id } = await params;
    const body = (await request.json()) as { name?: string };
    const name = (body.name || "").trim();
    if (!name) {
      return Response.json({ error: "name_required" }, { status: 400 });
    }
    await renameFolder(id, session.email, name);
    return Response.json({ ok: true, id, name });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur rename" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Non authentifie" }, { status: 401 });
    }
    const { id } = await params;
    await deleteFolder(id, session.email);
    return Response.json({ ok: true, id });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur suppression dossier" },
      { status: 500 }
    );
  }
}
