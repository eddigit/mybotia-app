import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("mybotia_access");
  return Response.json({ ok: true });
}
