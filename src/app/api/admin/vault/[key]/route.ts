// GET /api/admin/vault/[key] — reveal la valeur d'une seule KEY.
// Loggé. Les clés HIDDEN_KEYS sont refusées.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { HIDDEN_KEYS, requireVaultOwner } from "@/lib/vault/guard";
import { readVault } from "@/lib/vault/reader";
import { COOKIE_NAME, verifySessionToken } from "@/lib/vault/session";
import { auditVault } from "@/lib/vault/audit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ key: string }> };

export async function GET(_req: Request, { params }: Params) {
  const guard = await requireVaultOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const cookieStore = await cookies();
  const tok = cookieStore.get(COOKIE_NAME)?.value;
  if (!tok) return NextResponse.json({ error: "vault_locked" }, { status: 401 });
  const payload = await verifySessionToken(tok);
  if (!payload || payload.email !== guard.email) {
    return NextResponse.json({ error: "vault_locked" }, { status: 401 });
  }

  const { key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);
  if (!/^[A-Za-z][A-Za-z0-9_]{0,127}$/.test(key)) {
    return NextResponse.json({ error: "invalid_key" }, { status: 400 });
  }
  if (HIDDEN_KEYS.has(key)) {
    await auditVault({ user: guard.email, action: "reveal_blocked", key, ok: false });
    return NextResponse.json({ error: "forbidden_key" }, { status: 403 });
  }

  const { flat } = await readVault();
  const value = flat.get(key);
  if (value === undefined) {
    await auditVault({ user: guard.email, action: "reveal_missing", key, ok: false });
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await auditVault({ user: guard.email, action: "reveal", key, ok: true });
  return NextResponse.json({ key, value });
}
