// Bloc 6A — API admin tenants : liste.
// ACL : superadmin uniquement. Lecture DB `mybotia_core`.

import { adminQuery } from "@/lib/admin-db";
import { requireSuperadmin } from "@/lib/admin-auth";
import type { AdminTenantRow, TenantArchitectureConfig } from "@/lib/tenant-admin-config";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export async function GET() {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }

  try {
    const rows = await adminQuery<{
      id: string;
      slug: string;
      display_name: string;
      profile: string;
      status: string;
      legal_name: string | null;
      features: AdminTenantRow["features"];
      business_model: AdminTenantRow["businessModel"];
      architecture_config: TenantArchitectureConfig | null;
      quota_users: number | null;
      quota_storage_mb: number | null;
      quota_llm_tokens_daily: number | null;
      locale: string | null;
      timezone: string | null;
      updated_at: string | null;
      user_count: string;
    }>(
      `SELECT
         t.id,
         t.slug,
         t.display_name,
         t.profile,
         t.status,
         b.legal_name,
         COALESCE(s.features, '{}'::jsonb)        AS features,
         s.business_model,
         s.architecture_config,
         s.quota_users,
         s.quota_storage_mb,
         s.quota_llm_tokens_daily,
         s.locale,
         s.timezone,
         to_char(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at,
         (SELECT COUNT(*) FROM core.tenant_user tu WHERE tu.tenant_id = t.id) AS user_count
       FROM core.tenant t
       LEFT JOIN core.tenant_settings s ON s.tenant_id = t.id
       LEFT JOIN core.tenant_branding b ON b.tenant_id = t.id
       ORDER BY t.slug`
    );

    const tenants: AdminTenantRow[] = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      displayName: r.display_name,
      profile: r.profile,
      status: r.status,
      legalName: r.legal_name,
      features: r.features || {},
      businessModel: r.business_model,
      architectureConfig: r.architecture_config,
      quotaUsers: r.quota_users,
      quotaStorageMb: r.quota_storage_mb,
      quotaLlmTokensDaily: r.quota_llm_tokens_daily,
      locale: r.locale,
      timezone: r.timezone,
      updatedAt: r.updated_at,
      userCount: Number(r.user_count) || 0,
    }));

    return Response.json({ tenants }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}
