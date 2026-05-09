// V1.1.E — Audit log pour un tenant (lecture seule, superadmin only).
//
// GET /api/admin/tenants/[slug]/audit-log?limit=20
//
// Lit `mybotia_business.audit_logs` directement (même DB Postgres
// `mybotia_core`, schema `mybotia_business`). La table n'a pas de RLS active
// sur ce schema → l'accès est gardé exclusivement par requireSuperadmin().
//
// Doctrine : pas de proxy biz pour ne pas dépendre d'un endpoint à créer
// côté business. La lecture est strictement scopée par tenant_id résolu via
// le slug (la route ne fait jamais confiance au tenant courant du
// superadmin).

import { adminQuery } from "@/lib/admin-db";
import { requireSuperadmin } from "@/lib/admin-auth";
import type { AdminAuditLogEntry } from "@/types/admin-audit";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json(
      { error: auth.error },
      { status: auth.status, headers: NO_STORE },
    );
  }

  const { slug } = await params;
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") || DEFAULT_LIMIT);
  const limit = Math.max(1, Math.min(MAX_LIMIT, Number.isFinite(requestedLimit) ? requestedLimit : DEFAULT_LIMIT));

  try {
    // Résoudre le tenant_id depuis le slug (table core.tenant)
    const tenantRows = await adminQuery<{ id: string }>(
      "SELECT id FROM core.tenant WHERE slug = $1 LIMIT 1",
      [slug],
    );
    if (!tenantRows[0]) {
      return Response.json({ error: "tenant_not_found", slug }, { status: 404, headers: NO_STORE });
    }
    const tenantId = tenantRows[0].id;

    const rows = await adminQuery<{
      id: string;
      action: string;
      table_name: string;
      row_id: string;
      user_id: string | null;
      user_email: string | null;
      diff: unknown;
      created_at: string;
    }>(
      `SELECT al.id::text AS id,
              al.action,
              al.table_name,
              al.row_id,
              al.user_id::text AS user_id,
              u.email AS user_email,
              al.diff,
              to_char(al.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
         FROM mybotia_business.audit_logs al
         LEFT JOIN core."user" u ON u.id = al.user_id
        WHERE al.tenant_id = $1::uuid
        ORDER BY al.created_at DESC
        LIMIT $2`,
      [tenantId, limit],
    );

    const entries: AdminAuditLogEntry[] = rows.map((r) => ({
      id: r.id,
      action: r.action,
      tableName: r.table_name,
      rowId: r.row_id,
      userId: r.user_id,
      userEmail: r.user_email,
      diff: r.diff,
      createdAt: r.created_at,
    }));

    return Response.json(
      { tenant_slug: slug, tenant_id: tenantId, count: entries.length, entries },
      { headers: NO_STORE },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE },
    );
  }
}
