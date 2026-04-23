import { cookies } from "next/headers";

// Retourne toujours 200 pour éviter d'inonder la console d'erreurs 401 "normales"
// quand l'utilisateur n'est simplement pas connecté. Le front utilise le champ
// `authenticated` pour discriminer (auth-context.tsx).
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("mybotia_access")?.value;

  if (!token) {
    return Response.json({ authenticated: false, reason: "no_token" });
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return Response.json({ authenticated: false, reason: "invalid_token" });
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return Response.json({ authenticated: false, reason: "expired" });
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
    });
  } catch {
    return Response.json({ authenticated: false, reason: "decode_error" });
  }
}
