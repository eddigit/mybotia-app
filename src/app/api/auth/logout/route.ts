import { cookies } from "next/headers";

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || ".mybotia.com";

export async function POST() {
  const cookieStore = await cookies();
  // delete() sans domain ne supprime pas un cookie posé Domain=.mybotia.com
  // (le browser ne matche pas). On l'écrase avec maxAge=0 et le même Domain.
  cookieStore.set("mybotia_access", "", {
    domain: COOKIE_DOMAIN,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return Response.json({ ok: true });
}
