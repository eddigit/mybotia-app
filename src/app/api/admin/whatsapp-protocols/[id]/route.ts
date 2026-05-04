// LEA-WA-PROTOCOLS-MVP-ADMIN — PATCH + DELETE par id.

import { adminQuery } from "@/lib/admin-db";
import { requireSuperadmin } from "@/lib/admin-auth";
import {
  WA_PROTOCOL_CATEGORIES,
  WA_PROTOCOL_GILLES_INSTRUCTION_MODES,
  WA_PROTOCOL_RESPONSE_MODES,
  WA_PROTOCOL_STATUSES,
  type WaProtocolCategory,
  type WaProtocolGillesInstructionMode,
  type WaProtocolResponseMode,
  type WaProtocolStatus,
  type WhatsappProtocol,
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

const FIELD_MAP: Record<string, string> = {
  jid: "jid",
  groupName: "group_name",
  tenantSlug: "tenant_slug",
  agentSlug: "agent_slug",
  category: "category",
  responseMode: "response_mode",
  gillesInstructionMode: "gilles_instruction_mode",
  status: "status",
  operationalScope: "operational_scope",
  protocolText: "protocol_text",
  notes: "notes",
};

const SELECT_COLS = `id, jid, group_name, tenant_slug, agent_slug,
  category, response_mode, gilles_instruction_mode, status,
  operational_scope, protocol_text, notes,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: "id invalide" }, { status: 400, headers: NO_STORE });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "body json invalide" }, { status: 400, headers: NO_STORE });
  }

  const sets: string[] = [];
  const args: unknown[] = [];
  function pushSet(col: string, val: unknown) {
    args.push(val);
    sets.push(`${col} = $${args.length}`);
  }

  for (const [k, dbCol] of Object.entries(FIELD_MAP)) {
    if (!(k in body)) continue;
    const v = body[k];
    if (v === undefined) continue;

    if (k === "category") {
      if (typeof v !== "string" || !WA_PROTOCOL_CATEGORIES.includes(v as WaProtocolCategory))
        return Response.json(
          { error: `category invalide (allowed: ${WA_PROTOCOL_CATEGORIES.join(", ")})` },
          { status: 400, headers: NO_STORE }
        );
      pushSet(dbCol, v);
      continue;
    }
    if (k === "responseMode") {
      if (typeof v !== "string" || !WA_PROTOCOL_RESPONSE_MODES.includes(v as WaProtocolResponseMode))
        return Response.json(
          { error: `responseMode invalide (allowed: ${WA_PROTOCOL_RESPONSE_MODES.join(", ")})` },
          { status: 400, headers: NO_STORE }
        );
      pushSet(dbCol, v);
      continue;
    }
    if (k === "gillesInstructionMode") {
      if (
        typeof v !== "string" ||
        !WA_PROTOCOL_GILLES_INSTRUCTION_MODES.includes(v as WaProtocolGillesInstructionMode)
      )
        return Response.json(
          {
            error: `gillesInstructionMode invalide (allowed: ${WA_PROTOCOL_GILLES_INSTRUCTION_MODES.join(", ")})`,
          },
          { status: 400, headers: NO_STORE }
        );
      pushSet(dbCol, v);
      continue;
    }
    if (k === "status") {
      if (typeof v !== "string" || !WA_PROTOCOL_STATUSES.includes(v as WaProtocolStatus))
        return Response.json(
          { error: `status invalide (allowed: ${WA_PROTOCOL_STATUSES.join(", ")})` },
          { status: 400, headers: NO_STORE }
        );
      pushSet(dbCol, v);
      continue;
    }
    if (k === "jid" || k === "groupName" || k === "tenantSlug" || k === "agentSlug") {
      if (typeof v !== "string" || !v.trim())
        return Response.json({ error: `${k} doit etre une chaine non vide` }, { status: 400, headers: NO_STORE });
      pushSet(dbCol, v.trim());
      continue;
    }
    if (v === null) {
      sets.push(`${dbCol} = NULL`);
    } else {
      pushSet(dbCol, String(v));
    }
  }

  if (sets.length === 0) {
    return Response.json(
      { error: `aucun champ valide a mettre a jour (allowed: ${Object.keys(FIELD_MAP).join(", ")})` },
      { status: 400, headers: NO_STORE }
    );
  }
  sets.push(`updated_at = now()`);

  try {
    args.push(id);
    const updated = await adminQuery<Row>(
      `UPDATE core.whatsapp_protocols SET ${sets.join(", ")}
        WHERE id = $${args.length}
       RETURNING ${SELECT_COLS}`,
      args
    );
    if (!updated[0]) {
      return Response.json({ error: "protocole introuvable" }, { status: 404, headers: NO_STORE });
    }
    return Response.json({ item: mapRow(updated[0]) }, { headers: NO_STORE });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur DB";
    const status = /unique|duplicate/i.test(msg) ? 409 : 502;
    const error = status === 409 ? "JID déjà utilisé pour un autre protocole" : msg;
    return Response.json({ error }, { status, headers: NO_STORE });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: "id invalide" }, { status: 400, headers: NO_STORE });
  }
  try {
    const res = await adminQuery<{ id: string }>(
      `DELETE FROM core.whatsapp_protocols WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!res[0]) {
      return Response.json({ error: "protocole introuvable" }, { status: 404, headers: NO_STORE });
    }
    return Response.json({ ok: true, id: res[0].id }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}
