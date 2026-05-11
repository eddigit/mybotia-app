// GET /api/admin/vault — liste KEY masqué par section.
// Ne renvoie JAMAIS les valeurs — juste { key, comment, length, masked }.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { HIDDEN_KEYS, requireVaultOwner } from "@/lib/vault/guard";
import { readVault } from "@/lib/vault/reader";
import { COOKIE_NAME, verifySessionToken } from "@/lib/vault/session";
import { auditVault } from "@/lib/vault/audit";

export const dynamic = "force-dynamic";

export async function GET() {
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

  const { sections } = await readVault();
  const sanitized = sections
    .map((s) => ({
      name: s.name,
      entries: s.entries
        .filter((e) => !HIDDEN_KEYS.has(e.key))
        .map((e) => ({
          key: e.key,
          comment: e.comment,
          length: e.value.length,
          preview: maskPreview(e.value),
        })),
    }))
    .filter((s) => s.entries.length > 0);

  await auditVault({ user: guard.email, action: "list", ok: true });
  return NextResponse.json({
    sections: sanitized,
    sessionExpiresAt: new Date(payload.exp).toISOString(),
  });
}

function maskPreview(value: string): string {
  if (value.length === 0) return "";
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 2)}${"•".repeat(Math.max(4, value.length - 4))}${value.slice(-2)}`;
}
