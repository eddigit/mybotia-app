import { NextRequest, NextResponse } from "next/server";

const AUTH_URL = process.env.AUTH_URL!;
const AUTH_HOST = process.env.AUTH_HOST || "";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || ".mybotia.com";

/**
 * CL3 — logout propre.
 * 1. POST auth-service /logout en forwardant le cookie entrant
 *    → révoque la ligne core.session (refresh hash → revoked_at).
 * 2. Clear mybotia_access + mybotia_refresh côté navigateur, même si
 *    auth-service est injoignable (best-effort réseau).
 *
 * Sans (1), le mybotia_refresh resterait valide en DB et un attaquant
 * disposant du cookie pourrait recréer un access token pendant 30 jours.
 */
async function callAuthLogout(cookieHeader: string): Promise<void> {
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
      await client.request({
        method: "POST",
        path: "/logout",
        headers: {
          host: AUTH_HOST,
          "content-type": "application/json",
          cookie: cookieHeader,
        },
      });
    } finally {
      await client.close();
    }
    return;
  }

  await fetch(`${AUTH_URL}/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: cookieHeader,
    },
  });
}

export async function POST(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") ?? "";

  // Best-effort revoke server-side. On ne propage pas l'erreur côté front :
  // même si le réseau est cassé, on doit clear localement.
  try {
    if (cookieHeader.includes("mybotia_refresh")) {
      await callAuthLogout(cookieHeader);
    }
  } catch {
    // silently ignore — defensive clear ci-dessous couvre l'UX
  }

  const response = NextResponse.json({ ok: true });
  // Defensive clear : mêmes attributs que le login, MaxAge=0.
  response.cookies.set("mybotia_access", "", {
    domain: COOKIE_DOMAIN,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set("mybotia_refresh", "", {
    domain: COOKIE_DOMAIN,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
