import { getSessionMessages } from "@/lib/claude-bridge";
import { getSession } from "@/lib/session";
import { resolveCockpitTenant } from "@/lib/tenant-resolver";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const cockpit = await resolveCockpitTenant(request);
    const messages = await getSessionMessages(
      id,
      100,
      session.email,
      cockpit?.slug,
    );
    return Response.json(messages);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur messages" },
      { status: 500 }
    );
  }
}
