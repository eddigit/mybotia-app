import { cookies } from "next/headers";

/**
 * GET /api/auth/me
 *
 * Sémantique HTTP (CL3) :
 *  - 200 + authenticated:true  → JWT présent, valide, non expiré.
 *  - 200 + authenticated:false → utilisateur non connecté (no_token).
 *  - 401                       → token présent mais expiré ou invalide.
 *    Permet au wrapper apiFetch côté client de tenter un refresh
 *    transparent puis retry, sans considérer "non connecté".
 *
 * Note : on ne vérifie pas la signature ici (juste exp), parce que la
 * route sert à hydrater l'UI. Les endpoints qui dépendent de l'identité
 * réelle (server-side) passent par getSession() avec jwt.verify.
 */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("mybotia_access")?.value;

  if (!token) {
    return Response.json({ authenticated: false, reason: "no_token" });
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return Response.json(
        { authenticated: false, reason: "invalid_token" },
        { status: 401 },
      );
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return Response.json(
        { authenticated: false, reason: "expired" },
        { status: 401 },
      );
    }

    return Response.json({
      authenticated: true,
      user_id: payload.sub,
      email: payload.email,
      first_name: payload.first_name ?? null,
      last_name: payload.last_name ?? null,
      tenant_id: payload.tenant_id,
      tenant_slug: payload.tenant_slug,
      role: payload.role,
      is_superadmin: payload.is_superadmin,
      // V1.1.H.1 P0-UX-2 — exposes JWT exp (Unix timestamp in seconds) so
      // the client heartbeat can compute TTL without a round-trip.
      exp: payload.exp ?? null,
    });
  } catch {
    return Response.json(
      { authenticated: false, reason: "decode_error" },
      { status: 401 },
    );
  }
}
