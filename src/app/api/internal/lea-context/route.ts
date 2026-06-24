import { buildIntegrationContext } from "@/lib/claude-bridge";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

function authorize(request: Request): Response | null {
  const expected = process.env.MYBOTIA_INTERNAL_TOKEN;
  if (!expected) {
    return Response.json(
      { error: "internal_misconfigured" },
      { status: 500, headers: NO_STORE },
    );
  }

  const auth = request.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  if (match[1] !== expected) {
    return Response.json({ error: "forbidden" }, { status: 403, headers: NO_STORE });
  }
  return null;
}

export async function GET(request: Request) {
  const authError = authorize(request);
  if (authError) return authError;

  return Response.json(
    {
      agent: "lea",
      context: buildIntegrationContext(),
    },
    { headers: NO_STORE },
  );
}
