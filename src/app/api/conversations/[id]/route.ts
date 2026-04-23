import { deleteConversation, updateConversation } from "@/lib/claude-bridge";
import { getSession } from "@/lib/session";

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
    // Isolation stricte : toujours filtrer par session.email (meme pour superadmin),
    // pour empecher la suppression accidentelle d'une conv d'un autre user.
    await deleteConversation(id, session.email);
    return Response.json({ ok: true, id });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur suppression" },
      { status: 500 }
    );
  }
}

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
    const body = (await request.json()) as { folder_id?: string | null; title?: string };
    const patch: { folder_id?: string | null; title?: string } = {};
    if ("folder_id" in body) patch.folder_id = body.folder_id ?? null;
    if (typeof body.title === "string") patch.title = body.title;
    if (Object.keys(patch).length === 0) {
      return Response.json({ error: "nothing_to_update" }, { status: 400 });
    }
    await updateConversation(id, patch, session.email);
    return Response.json({ ok: true, id });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur update" },
      { status: 500 }
    );
  }
}
