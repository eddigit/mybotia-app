import { cookies } from "next/headers";

const AUTH_URL = process.env.AUTH_URL!;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const res = await fetch(`${AUTH_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return Response.json(data, { status: res.status });
    }

    // Set access token as httpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set("mybotia_access", data.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60, // 15 min
    });

    // Return user + tenant info (without raw token)
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
