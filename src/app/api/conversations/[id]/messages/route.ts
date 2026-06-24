import { getSessionMessages } from "@/lib/claude-bridge";
import { resolveChatCockpit } from "@/lib/v4/session";

// V1.1.H P0-1 — ACL tenant_slug sur lecture messages
// Remplace resolveCockpitTenant (sans ACL) par resolveChatCockpit qui
// vérifie : session valide, cockpit connu, user normal → tenant cockpit = tenant JWT.
// tenant_slug validé est ensuite transmis au bridge pour filtrage SQL.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cockpit = await resolveChatCockpit(request);
  if (!cockpit.ok) {
    return Response.json({ error: cockpit.error }, { status: cockpit.status });
  }
  try {
    const { id } = await params;
    const { tenantSlug } = cockpit;
    const messages = await getSessionMessages(id, 100, tenantSlug);
    return Response.json(messages);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur messages" },
      { status: 500 }
    );
  }
}
