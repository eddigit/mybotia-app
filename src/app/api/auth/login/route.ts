import { cookies } from "next/headers";

const AUTH_URL = process.env.AUTH_URL!;
const AUTH_HOST = process.env.AUTH_HOST || "";

/**
 * Fetch the auth service. When AUTH_URL is a direct IP (Vercel → VPS),
 * use undici Client with explicit HTTP/1.1 ALPN + SNI servername to
 * bypass Apache HTTP/2 421 misdirected-request.
 */
async function authFetch(path: string, body: string): Promise<{ status: number; data: Record<string, unknown> }> {
  const isDirectIP = /^https:\/\/\d+\.\d+\.\d+\.\d+/.test(AUTH_URL);

  if (isDirectIP && AUTH_HOST) {
    const { Client } = await import("undici");
    const client = new Client(AUTH_URL, {
      connect: {
        servername: AUTH_HOST,
        ALPNProtocols: ["http/1.1"],
      },
    });
    try {
      const { statusCode, body: resBody } = await client.request({
        method: "POST",
        path,
        headers: { "content-type": "application/json", host: AUTH_HOST },
        body,
      });
      const text = await resBody.text();
      return { status: statusCode, data: JSON.parse(text) };
    } finally {
      await client.close();
    }
  }

  // Local dev / hostname-based AUTH_URL
  const res = await fetch(`${AUTH_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return { status: res.status, data: await res.json() };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { status, data } = await authFetch("/login", JSON.stringify(body));

    if (status >= 400) {
      return Response.json(data, { status });
    }

    // Set access token as httpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set("mybotia_access", data.access_token as string, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60,
    });

    return Response.json({
      user: data.user,
      tenant: data.tenant,
      tenants: data.tenants,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur auth" },
      { status: 502 }
    );
  }
}
