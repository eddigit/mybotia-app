import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("mybotia_access")?.value;

  if (!token) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Decode JWT payload (no verification needed here — middleware handles it)
    const parts = token.split(".");
    if (parts.length !== 3) {
      return Response.json({ error: "Invalid token" }, { status: 401 });
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );

    // Check expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return Response.json({ error: "Token expired" }, { status: 401 });
    }

    return Response.json({
      user_id: payload.sub,
      email: payload.email,
      tenant_id: payload.tenant_id,
      tenant_slug: payload.tenant_slug,
      role: payload.role,
      is_superadmin: payload.is_superadmin,
    });
  } catch {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }
}
