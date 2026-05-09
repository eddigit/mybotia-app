import { deleteConversation, updateConversation } from "@/lib/claude-bridge";
import { resolveChatCockpit } from "@/lib/v4/session";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // V1.1.G — Validation cockpit (tenant + agent) avant DELETE.
    const cockpit = await resolveChatCockpit(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status });
    }
    const { session } = cockpit;
    const { id } = await params;
    // Isolation user_email + cockpit. Le bridge legacy ne sait pas filtrer
    // par tenant_slug — on s'appuie sur user_email + presence cockpit valide
    // (déjà validé par resolveChatCockpit).
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
    const cockpit = await resolveChatCockpit(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status });
    }
    const { session } = cockpit;
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
