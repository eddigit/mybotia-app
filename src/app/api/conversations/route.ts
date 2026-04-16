import {
  listConversations,
  sendAgentMessage,
  projectSessionId,
  getProjectMemory,
} from "@/lib/openclaw";

export async function GET() {
  try {
    const conversations = await listConversations();
    return Response.json(conversations);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur conversations" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      agentId,
      message,
      sessionId,
      projectId,
      projectRef,
      projectName,
      clientName,
      projectDescription,
    } = body;

    if (!message) {
      return Response.json(
        { error: "message est requis" },
        { status: 400 }
      );
    }

    // Determine session ID — use deterministic project session if project is specified
    const effectiveSessionId =
      sessionId ||
      (projectId ? projectSessionId(projectId, agentId || "main") : undefined);

    // Build project context if project info is provided
    const projectContext =
      projectRef && projectName
        ? {
            projectRef,
            projectName,
            clientName,
            description: projectDescription,
          }
        : undefined;

    const response = await sendAgentMessage(
      agentId || "main",
      message,
      effectiveSessionId,
      projectContext
    );

    if (response.error) {
      return Response.json({ error: response.error }, { status: 502 });
    }

    return Response.json(response);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur envoi message" },
      { status: 500 }
    );
  }
}
