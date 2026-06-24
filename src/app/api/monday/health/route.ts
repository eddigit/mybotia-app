import { mondayGraphql, mondayIsConfigured } from "@/lib/monday";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

type MondayMeResponse = {
  me: {
    id: string;
    name: string;
    email?: string | null;
  };
};

export async function GET() {
  if (!mondayIsConfigured()) {
    return Response.json(
      {
        configured: false,
        requiredEnv: "MONDAY_MYBOTIA_API_TOKEN",
        error: { code: "missing_credentials", message: "Token Monday absent cote serveur." },
      },
      { status: 503, headers: NO_STORE },
    );
  }

  const result = await mondayGraphql<MondayMeResponse>(`
    query MondayHealth {
      me {
        id
        name
        email
      }
    }
  `);

  if (!result.ok) {
    return Response.json(
      { configured: true, requiredEnv: "MONDAY_MYBOTIA_API_TOKEN", error: result.error },
      { status: 503, headers: NO_STORE },
    );
  }

  return Response.json(
    {
      configured: true,
      requiredEnv: "MONDAY_MYBOTIA_API_TOKEN",
      account: result.data.me,
    },
    { headers: NO_STORE },
  );
}
