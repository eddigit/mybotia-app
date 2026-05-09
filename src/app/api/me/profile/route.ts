// V1.1.I-A — PATCH /api/me/profile + GET /api/me/profile
//
// Règles de sécurité (G4 audit) :
//  - Auth obligatoire via getSession() (JWT HS256 vérifié)
//  - ACL stricte WHERE id = session.userId — aucun superadmin ne peut
//    modifier le profil d'un autre user via ce endpoint.
//  - email NON modifiable (lecture seule, géré par auth-service).
//  - Validation manuelle (zod absent du bundle).
//  - Écriture Postgres directe (même pattern que /api/me/tenants + /api/me/features).
//  - audit_log : différé V1.2 (pas de pattern INSERT audit_logs côté cockpit V1.1).
//
// Pattern : adminQuery depuis lib/admin-db (pool mybotia_core, schema core).

import { getSession } from "@/lib/session";
import { adminQuery } from "@/lib/admin-db";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

// Timezones courantes acceptées (liste permissive côté serveur — validation UI côté form)
const TIMEZONE_PATTERN = /^[A-Za-z_]+\/[A-Za-z_/+\-]+$/;

interface ProfilePreferences {
  notifications_email?: boolean;
  notifications_whatsapp?: boolean;
  theme?: "light" | "dark" | "auto";
  language?: "fr" | "en";
}

interface ProfilePatchBody {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  timezone?: string;
  email_signature?: string | null;
  avatar_url?: string | null;
  preferences?: ProfilePreferences;
}

function sanitizeString(v: unknown, maxLen = 500): string | null | undefined {
  if (v === null) return null;
  if (v === undefined) return undefined;
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  if (trimmed.length > maxLen) return undefined; // rejeté silencieusement
  return trimmed || null;
}

// ---------------------------------------------------------------------------
// GET /api/me/profile — profil complet depuis DB (inclut les nouvelles colonnes)
// ---------------------------------------------------------------------------
export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Non authentifie" }, { status: 401, headers: NO_STORE });
  }

  try {
    const rows = await adminQuery<{
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
      locale: string;
      phone: string | null;
      timezone: string;
      email_signature: string | null;
      preferences: ProfilePreferences;
      is_superadmin: boolean;
      last_login_at: string | null;
    }>(
      `SELECT id, email, first_name, last_name, avatar_url, locale,
              phone, timezone, email_signature, preferences,
              is_superadmin, last_login_at
         FROM core."user"
        WHERE id = $1::uuid`,
      [session.userId]
    );

    if (!rows[0]) {
      return Response.json({ error: "user_not_found" }, { status: 404, headers: NO_STORE });
    }

    const u = rows[0];
    return Response.json({
      id: u.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      avatar_url: u.avatar_url,
      locale: u.locale,
      phone: u.phone,
      timezone: u.timezone,
      email_signature: u.email_signature,
      preferences: {
        notifications_email: (u.preferences as Record<string, unknown>)?.notifications_email ?? true,
        notifications_whatsapp: (u.preferences as Record<string, unknown>)?.notifications_whatsapp ?? true,
        theme: (u.preferences as Record<string, unknown>)?.theme ?? "auto",
        language: (u.preferences as Record<string, unknown>)?.language ?? "fr",
      },
      is_superadmin: u.is_superadmin,
      last_login_at: u.last_login_at,
    }, { headers: NO_STORE });
  } catch (e) {
    console.error("[api/me/profile] GET error", e instanceof Error ? e.message : e);
    return Response.json({ error: "db_error" }, { status: 503, headers: NO_STORE });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/me/profile — mise à jour des champs profil
// ---------------------------------------------------------------------------
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Non authentifie" }, { status: 401, headers: NO_STORE });
  }

  let body: ProfilePatchBody;
  try {
    body = (await request.json()) as ProfilePatchBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: NO_STORE });
  }

  // Validation manuelle des champs
  const updates: Record<string, unknown> = {};
  const errors: string[] = [];

  if ("first_name" in body) {
    const v = sanitizeString(body.first_name, 100);
    if (v !== undefined) updates.first_name = v;
    else errors.push("first_name: invalide (max 100 car.)");
  }
  if ("last_name" in body) {
    const v = sanitizeString(body.last_name, 100);
    if (v !== undefined) updates.last_name = v;
    else errors.push("last_name: invalide (max 100 car.)");
  }
  if ("phone" in body) {
    const v = sanitizeString(body.phone, 30);
    if (v !== undefined) updates.phone = v;
    else errors.push("phone: invalide (max 30 car.)");
  }
  if ("timezone" in body) {
    const tz = body.timezone;
    if (
      typeof tz === "string" &&
      tz.trim().length > 0 &&
      tz.trim().length <= 64 &&
      TIMEZONE_PATTERN.test(tz.trim())
    ) {
      updates.timezone = tz.trim();
    } else {
      errors.push("timezone: format invalide (ex: Europe/Paris)");
    }
  }
  if ("email_signature" in body) {
    const v = sanitizeString(body.email_signature, 2000);
    if (v !== undefined) updates.email_signature = v;
    else errors.push("email_signature: invalide (max 2000 car.)");
  }
  if ("avatar_url" in body) {
    const v = body.avatar_url;
    if (v === null) {
      updates.avatar_url = null;
    } else if (typeof v === "string" && v.trim().length > 0 && v.trim().length <= 1000) {
      // Accepte uniquement https:// ou data: (upload Cloudinary renvoie https)
      const url = v.trim();
      if (url.startsWith("https://") || url.startsWith("data:")) {
        updates.avatar_url = url;
      } else {
        errors.push("avatar_url: doit commencer par https://");
      }
    } else {
      errors.push("avatar_url: invalide");
    }
  }
  if ("preferences" in body) {
    const pref = body.preferences;
    if (pref && typeof pref === "object") {
      const cleaned: ProfilePreferences = {};
      if (typeof pref.notifications_email === "boolean")
        cleaned.notifications_email = pref.notifications_email;
      if (typeof pref.notifications_whatsapp === "boolean")
        cleaned.notifications_whatsapp = pref.notifications_whatsapp;
      if (["light", "dark", "auto"].includes(pref.theme ?? ""))
        cleaned.theme = pref.theme;
      if (["fr", "en"].includes(pref.language ?? ""))
        cleaned.language = pref.language;
      // Merge JSONB côté SQL pour ne pas écraser les clés futures
      updates._preferences_merge = cleaned;
    } else {
      errors.push("preferences: objet attendu");
    }
  }

  if (errors.length > 0) {
    return Response.json({ error: "validation_error", details: errors }, { status: 422, headers: NO_STORE });
  }
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "no_fields" }, { status: 400, headers: NO_STORE });
  }

  // Construire la requête UPDATE dynamique
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (key === "_preferences_merge") {
      // Merge JSONB : preferences = preferences || $N::jsonb
      setClauses.push(`preferences = preferences || $${paramIdx}::jsonb`);
      params.push(JSON.stringify(value));
    } else {
      setClauses.push(`"${key}" = $${paramIdx}`);
      params.push(value);
    }
    paramIdx++;
  }

  // updated_at
  setClauses.push(`updated_at = now()`);

  // WHERE strictement sur l'utilisateur authentifié (G4)
  params.push(session.userId);
  const whereParam = paramIdx;

  const sql = `
    UPDATE core."user"
    SET ${setClauses.join(", ")}
    WHERE id = $${whereParam}::uuid
    RETURNING
      id, email, first_name, last_name, avatar_url, locale,
      phone, timezone, email_signature, preferences,
      is_superadmin, last_login_at, updated_at
  `;

  try {
    const rows = await adminQuery<{
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
      locale: string;
      phone: string | null;
      timezone: string;
      email_signature: string | null;
      preferences: ProfilePreferences;
      is_superadmin: boolean;
      last_login_at: string | null;
      updated_at: string;
    }>(sql, params);

    if (!rows[0]) {
      return Response.json({ error: "user_not_found" }, { status: 404, headers: NO_STORE });
    }

    const u = rows[0];
    // audit_log : différé V1.2 — pas de pattern INSERT cockpit existant.
    // TODO V1.2 : INSERT INTO mybotia_business.audit_logs (action, table_name, row_id, user_id, diff)

    return Response.json({
      id: u.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      avatar_url: u.avatar_url,
      locale: u.locale,
      phone: u.phone,
      timezone: u.timezone,
      email_signature: u.email_signature,
      preferences: {
        notifications_email: (u.preferences as Record<string, unknown>)?.notifications_email ?? true,
        notifications_whatsapp: (u.preferences as Record<string, unknown>)?.notifications_whatsapp ?? true,
        theme: (u.preferences as Record<string, unknown>)?.theme ?? "auto",
        language: (u.preferences as Record<string, unknown>)?.language ?? "fr",
      },
      is_superadmin: u.is_superadmin,
      last_login_at: u.last_login_at,
      updated_at: u.updated_at,
    }, { headers: NO_STORE });
  } catch (e) {
    console.error("[api/me/profile] PATCH error", e instanceof Error ? e.message : e);
    return Response.json({ error: "db_error" }, { status: 503, headers: NO_STORE });
  }
}
