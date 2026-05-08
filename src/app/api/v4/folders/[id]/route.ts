import { query } from "@/lib/v4/db";
import { apiError } from "@/lib/v4/errors";
import { getSessionV4 } from "@/lib/v4/session";

interface FolderRow {
  id: string;
  tenant_slug: string;
  user_email: string;
  name: string;
  description: string | null;
  agent_id: string | null;
  client_ref: string | null;
  project_ref: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toApi(r: FolderRow) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    agentId: r.agent_id,
    clientRef: r.client_ref,
    projectRef: r.project_ref,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// PATCH : { name?, archived?, cascade? }
//   name      -> renommer
//   archived  -> true = soft-archive le dossier
//   cascade   -> "archive-children" | "move-out" : politique pour conv contenues
//                quand on archive le dossier (sinon les conv pointent sur un folder caché).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionV4();
  if (!session) return apiError("unauthorized", "Non authentifié");
  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError("not_found", "Dossier introuvable");

  const own = await query<{ id: string }>(
    `SELECT id FROM chat.folders
     WHERE id=$1 AND tenant_slug=$2 AND user_email=$3 AND archived_at IS NULL`,
    [id, session.tenantSlug, session.email]
  );
  if (own.rowCount === 0) return apiError("not_found", "Dossier introuvable");

  let body: {
    name?: string;
    archived?: boolean;
    cascade?: "archive-children" | "move-out";
  };
  try {
    body = await request.json();
  } catch {
    return apiError("validation_failed", "Body JSON invalide");
  }

  // Cas 1 : rename simple
  if (typeof body.name === "string" && body.archived === undefined) {
    const name = body.name.trim();
    if (!name) return apiError("validation_failed", "name requis", { field: "name" });
    if (name.length > 200) return apiError("validation_failed", "name trop long");
    try {
      const { rows } = await query<FolderRow>(
        `UPDATE chat.folders SET name = $1, updated_at = now()
         WHERE id = $2 AND tenant_slug = $3 AND user_email = $4
         RETURNING *`,
        [name, id, session.tenantSlug, session.email]
      );
      return Response.json(toApi(rows[0]));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("folders_unique_name")) {
        return apiError("conflict", `Dossier "${name}" déjà existant`, { field: "name" });
      }
      console.error("[v4/folders/:id] PATCH rename error:", e);
      return apiError("validation_failed", "Erreur renommage");
    }
  }

  // Cas 2 : archive (avec stratégie pour les conv)
  if (body.archived === true) {
    if (body.cascade === "archive-children") {
      await query(
        `UPDATE chat.conversations
         SET archived_at = now(), updated_at = now()
         WHERE folder_id = $1 AND tenant_slug = $2 AND user_email = $3
           AND archived_at IS NULL`,
        [id, session.tenantSlug, session.email]
      );
    } else if (body.cascade === "move-out") {
      await query(
        `UPDATE chat.conversations
         SET folder_id = NULL, updated_at = now()
         WHERE folder_id = $1 AND tenant_slug = $2 AND user_email = $3
           AND archived_at IS NULL`,
        [id, session.tenantSlug, session.email]
      );
    } else {
      // Pas de stratégie : on refuse si le dossier n'est pas vide pour éviter
      // que des conversations pointent sur un dossier "fantôme" archivé.
      const { rows } = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM chat.conversations
         WHERE folder_id = $1 AND tenant_slug = $2 AND user_email = $3
           AND archived_at IS NULL`,
        [id, session.tenantSlug, session.email]
      );
      if (Number(rows[0].count) > 0) {
        return apiError(
          "conflict",
          "Dossier non vide — précisez cascade=archive-children ou move-out",
          { field: "cascade" }
        );
      }
    }
    const { rows } = await query<FolderRow>(
      `UPDATE chat.folders SET archived_at = now(), updated_at = now()
       WHERE id = $1 AND tenant_slug = $2 AND user_email = $3
       RETURNING *`,
      [id, session.tenantSlug, session.email]
    );
    return Response.json(toApi(rows[0]));
  }

  return apiError("validation_failed", "Aucune opération valide (name ou archived requis)");
}

// DELETE : suppression définitive du dossier.
// Query ?cascade=delete-children -> supprime aussi les conv (CASCADE messages)
// Query ?cascade=move-out        -> passe folder_id=NULL puis DELETE folder
// Sans cascade -> refuse si folder non vide.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionV4();
  if (!session) return apiError("unauthorized", "Non authentifié");
  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError("not_found", "Dossier introuvable");

  const own = await query<{ id: string }>(
    `SELECT id FROM chat.folders
     WHERE id=$1 AND tenant_slug=$2 AND user_email=$3`,
    [id, session.tenantSlug, session.email]
  );
  if (own.rowCount === 0) return apiError("not_found", "Dossier introuvable");

  const url = new URL(request.url);
  const cascade = url.searchParams.get("cascade");

  if (cascade === "delete-children") {
    await query(
      `DELETE FROM chat.conversations
       WHERE folder_id = $1 AND tenant_slug = $2 AND user_email = $3`,
      [id, session.tenantSlug, session.email]
    );
  } else if (cascade === "move-out") {
    await query(
      `UPDATE chat.conversations
       SET folder_id = NULL, updated_at = now()
       WHERE folder_id = $1 AND tenant_slug = $2 AND user_email = $3`,
      [id, session.tenantSlug, session.email]
    );
  } else {
    const { rows } = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM chat.conversations
       WHERE folder_id = $1 AND tenant_slug = $2 AND user_email = $3`,
      [id, session.tenantSlug, session.email]
    );
    if (Number(rows[0].count) > 0) {
      return apiError(
        "conflict",
        "Dossier non vide — précisez cascade=delete-children ou move-out",
        { field: "cascade" }
      );
    }
  }

  await query(
    `DELETE FROM chat.folders
     WHERE id = $1 AND tenant_slug = $2 AND user_email = $3`,
    [id, session.tenantSlug, session.email]
  );
  return Response.json({ ok: true, id });
}
