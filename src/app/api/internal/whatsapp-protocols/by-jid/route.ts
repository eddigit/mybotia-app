// LEA-WA-RUNTIME Phase A — Route INTERNE : lookup protocole WhatsApp par JID.
//
// Doctrine sécurité (mêmes règles que /api/internal/usage/tokens) :
//   - Bearer token MYBOTIA_INTERNAL_TOKEN obligatoire (env partagé bridge ↔ app).
//   - Sans token → 401.
//   - Mauvais token → 403.
//   - Aucun contenu utilisateur loggé.
//   - Aucun secret rendu dans les réponses.
//   - Pas de durcissement IP/host (le Bearer fort suffit ; durcissement Nginx
//     en bloc dédié si nécessaire).
//
// Comportement :
//   - JID accepté avec ou sans suffixe @g.us, normalisé en @g.us.
//   - 200 si protocole trouvé ET status='active'.
//   - 404 si absent OU status != 'active' (pas de fuite : on ne dit pas "désactivé").
//
// Branchement runtime (Phase B+) :
//   claude-bridge appellera cette route à chaque message WhatsApp groupe pour
//   injecter le protocole dans le prompt système avant exécution.

import { adminQuery } from "@/lib/admin-db";
import type {
  WaProtocolCategory,
  WaProtocolGillesInstructionMode,
  WaProtocolResponseMode,
  WaProtocolStatus,
  WhatsappProtocol,
} from "@/lib/whatsapp-protocol-types";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

interface Row {
  id: string;
  jid: string;
  group_name: string;
  tenant_slug: string;
  agent_slug: string;
  category: WaProtocolCategory;
  response_mode: WaProtocolResponseMode;
  gilles_instruction_mode: WaProtocolGillesInstructionMode;
  status: WaProtocolStatus;
  operational_scope: string;
  protocol_text: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(r: Row): WhatsappProtocol {
  return {
    id: r.id,
    jid: r.jid,
    groupName: r.group_name,
    tenantSlug: r.tenant_slug,
    agentSlug: r.agent_slug,
    category: r.category,
    responseMode: r.response_mode,
    gillesInstructionMode: r.gilles_instruction_mode,
    status: r.status,
    operationalScope: r.operational_scope,
    protocolText: r.protocol_text,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function GET(request: Request) {
  // 1. Auth Bearer
  const expected = process.env.MYBOTIA_INTERNAL_TOKEN;
  if (!expected) {
    return Response.json(
      { error: "internal_misconfigured" },
      { status: 500, headers: NO_STORE }
    );
  }
  const auth = request.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  if (m[1] !== expected) {
    return Response.json({ error: "forbidden" }, { status: 403, headers: NO_STORE });
  }

  // 2. JID + normalisation
  const url = new URL(request.url);
  const jidParam = (url.searchParams.get("jid") || "").trim();
  if (!jidParam) {
    return Response.json({ error: "jid requis" }, { status: 400, headers: NO_STORE });
  }
  // Validation minimale : commence par chiffres, format Baileys
  if (!/^[0-9]+(@(g\.us|s\.whatsapp\.net|lid))?$/.test(jidParam)) {
    return Response.json({ error: "jid invalide" }, { status: 400, headers: NO_STORE });
  }
  const jid = jidParam.includes("@") ? jidParam : `${jidParam}@g.us`;

  // 3. Lookup DB — uniquement protocoles status='active'
  try {
    const rows = await adminQuery<Row>(
      `SELECT id, jid, group_name, tenant_slug, agent_slug,
              category, response_mode, gilles_instruction_mode, status,
              operational_scope, protocol_text, notes,
              to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
              to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
         FROM core.whatsapp_protocols
        WHERE jid = $1 AND status = 'active'
        LIMIT 1`,
      [jid]
    );
    if (!rows[0]) {
      // 404 unifié : absent OU désactivé. Pas de fuite d'état interne.
      return Response.json(
        { error: "protocole introuvable ou inactif" },
        { status: 404, headers: NO_STORE }
      );
    }
    return Response.json(mapRow(rows[0]), { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}
