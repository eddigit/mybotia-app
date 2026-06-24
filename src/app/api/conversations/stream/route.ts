import { resolveChatCockpit } from "@/lib/v4/session";
import { buildIntegrationContext, projectSessionId } from "@/lib/claude-bridge";

const BRIDGE_URL = process.env.CLAUDE_BRIDGE_URL || "http://127.0.0.1:9400";
// Sprint clôture hotfix 2026-04-25 : token strictement via env, zéro fallback.
function requireBridgeToken(): string {
  const t = process.env.CLAUDE_BRIDGE_TOKEN;
  if (!t) {
    throw new Error(
      "CLAUDE_BRIDGE_TOKEN missing. Set it in /opt/mybotia/mybotia-app/.env.local",
    );
  }
  return t;
}
const TENANT_AGENT_MAP: Record<string, string> = {
  mybotia: "lea",
  vlmedical: "max",
  igh: "lucy",
  cmb_lux: "raphael",
  esprit_loft: "maria",
};

export async function POST(request: Request) {
  const bridgeToken = requireBridgeToken();
  // V1.1.G — Stream cockpit-aware (tenant + agent du cockpit, pas du JWT).
  const cockpit = await resolveChatCockpit(request);
  if (!cockpit.ok) {
    return Response.json({ error: cockpit.error }, { status: cockpit.status });
  }
  const { session, tenantSlug, agentId: cockpitAgent } = cockpit;

  const body = await request.json();
  const {
    agentId: requestedAgentId,
    message,
    sessionId,
    projectId,
    projectRef,
    projectName,
    clientName,
    projectDescription,
    modelTier: requestedModelTier,
  } = body;

  if (!message) {
    return Response.json({ error: "message est requis" }, { status: 400 });
  }

  // Tier modele : "fast" (Sonnet, defaut) ou "deep" (Opus, mode reflexion)
  const modelTier: "fast" | "deep" =
    requestedModelTier === "deep" ? "deep" : "fast";

  const agentId =
    session.isSuperadmin && requestedAgentId
      ? requestedAgentId
      : (TENANT_AGENT_MAP[tenantSlug] || cockpitAgent);

  const userContext = {
    name: session.email,
    email: session.email,
    role: session.role,
    tenant_slug: tenantSlug,
    is_superadmin: session.isSuperadmin,
  };

  const effectiveSessionId =
    sessionId ||
    (projectId ? projectSessionId(projectId, agentId) : undefined);

  const projectContext =
    projectRef && projectName
      ? { projectRef, projectName, clientName, description: projectDescription }
      : undefined;

  const bridgeRes = await fetch(`${BRIDGE_URL}/chat/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bridgeToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      session_id: effectiveSessionId,
      agent_id: agentId,
      project_context: projectContext,
      user_context: userContext,
      integration_context: buildIntegrationContext(),
      model_tier: modelTier,
    }),
  });

  if (!bridgeRes.ok || !bridgeRes.body) {
    return Response.json(
      { error: `Bridge error: ${bridgeRes.status}` },
      { status: 502 }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const reader = bridgeRes.body!.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(new TextEncoder().encode(decoder.decode(value, { stream: true })));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
