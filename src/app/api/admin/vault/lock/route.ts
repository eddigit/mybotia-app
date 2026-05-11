// POST /api/admin/vault/lock — révoque la session vault (suppression cookie).

import { NextResponse } from "next/server";

import { requireVaultOwner } from "@/lib/vault/guard";
import { COOKIE_NAME } from "@/lib/vault/session";
import { auditVault } from "@/lib/vault/audit";

export const dynamic = "force-dynamic";

export async function POST() {
  const guard = await requireVaultOwner();
  if (guard.ok) {
    await auditVault({ user: guard.email, action: "lock", ok: true });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
