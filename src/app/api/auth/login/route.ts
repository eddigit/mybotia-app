import { NextResponse } from "next/server";

const AUTH_URL = process.env.AUTH_URL!;
const AUTH_HOST = process.env.AUTH_HOST || "";

/**
 * Domaine du cookie d'auth. .mybotia.com par défaut → cookie lisible
 * cross-subdomain (app, crm, etc.). Override via env si besoin (dev local).
 */
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || ".mybotia.com";

type AuthFetchResult = {
  status: number;
  data: Record<string, unknown>;
  setCookies: string[];
};

/**
 * Fetch the auth service. When AUTH_URL is a direct IP (Vercel → VPS),
 * use undici Client with explicit HTTP/1.1 ALPN + SNI servername to
 * bypass Apache HTTP/2 421 misdirected-request.
 *
 * CL3 étape 0 : on remonte aussi les Set-Cookie (mybotia_access +
 * mybotia_refresh) pour pouvoir les forwarder au navigateur. Sans ça
 * `mybotia_refresh` reste prisonnier du flow serveur et le wrapper
 * apiFetch ne pourrait jamais renouveler la session.
 */
async function authFetch(path: string, body: string): Promise<AuthFetchResult> {
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
      const { statusCode, body: resBody, headers } = await client.request({
        method: "POST",
        path,
        headers: { "content-type": "application/json", host: AUTH_HOST },
        body,
      });
      const text = await resBody.text();
      const rawSetCookie = headers["set-cookie"];
      const setCookies = Array.isArray(rawSetCookie)
        ? rawSetCookie
        : typeof rawSetCookie === "string"
          ? [rawSetCookie]
          : [];
      return {
        status: statusCode,
        data: JSON.parse(text) as Record<string, unknown>,
        setCookies,
      };
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
  const setCookies = res.headers.getSetCookie?.() ?? [];
  return {
    status: res.status,
    data: (await res.json()) as Record<string, unknown>,
    setCookies,
  };
}

function rewriteSetCookieDomain(raw: string): string {
  // auth-service pose déjà Domain=.mybotia.com via COOKIE_DOMAIN.
  // En dev local (COOKIE_DOMAIN absent côté auth-service) on force le bon domaine.
  if (/;\s*domain=/i.test(raw)) return raw;
  return `${raw}; Domain=${COOKIE_DOMAIN}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { status, data, setCookies } = await authFetch(
      "/login",
      JSON.stringify(body),
    );

    if (status >= 400) {
      return NextResponse.json(data, { status });
    }

    const response = NextResponse.json({
      user: data.user,
      tenant: data.tenant,
      tenants: data.tenants,
    });

    // Forward auth-service Set-Cookie (mybotia_access + mybotia_refresh).
    // Ne JAMAIS logger leur valeur.
    for (const sc of setCookies) {
      response.headers.append("set-cookie", rewriteSetCookieDomain(sc));
    }

    return response;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur auth" },
      { status: 502 },
    );
  }
}
