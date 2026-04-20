import { getSessionMessages } from "@/lib/claude-bridge";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messages = await getSessionMessages(id, 100);
    return Response.json(messages);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur messages" },
      { status: 500 }
    );
  }
}
