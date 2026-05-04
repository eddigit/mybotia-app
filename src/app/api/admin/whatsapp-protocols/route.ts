// LEA-WA-PROTOCOLS-MVP-ADMIN — GET liste + POST création.
// requireSuperadmin partout. Aucun appel WhatsApp, aucun envoi.

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

const SELECT_COLS = `id, jid, group_name, tenant_slug, agent_slug,
  category, response_mode, gilles_instruction_mode, status,
  operational_scope, protocol_text, notes,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`;

export async function GET() {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  try {
    const rows = await adminQuery<Row>(
      `SELECT ${SELECT_COLS}
         FROM core.whatsapp_protocols
        ORDER BY status, tenant_slug, group_name`
    );
    return Response.json({ items: rows.map(mapRow) }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}

interface CreateBody {
  jid: string;
  groupName: string;
  tenantSlug: string;
  agentSlug?: string;
  category?: WaProtocolCategory;
  responseMode?: WaProtocolResponseMode;
  gillesInstructionMode?: WaProtocolGillesInstructionMode;
  status?: WaProtocolStatus;
  operationalScope?: string;
  protocolText?: string;
  notes?: string | null;
}

function validateCreate(body: unknown): { ok: true; data: CreateBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "body invalide" };
  const b = body as Record<string, unknown>;
  if (typeof b.jid !== "string" || !b.jid.trim()) return { ok: false, error: "jid requis" };
  if (typeof b.groupName !== "string" || !b.groupName.trim()) return { ok: false, error: "groupName requis" };
  if (typeof b.tenantSlug !== "string" || !b.tenantSlug.trim()) return { ok: false, error: "tenantSlug requis" };

  const category = typeof b.category === "string" ? b.category : "support_client";
  if (!WA_PROTOCOL_CATEGORIES.includes(category as WaProtocolCategory))
    return { ok: false, error: `category invalide (allowed: ${WA_PROTOCOL_CATEGORIES.join(", ")})` };

  const responseMode = typeof b.responseMode === "string" ? b.responseMode : "draft_only";
  if (!WA_PROTOCOL_RESPONSE_MODES.includes(responseMode as WaProtocolResponseMode))
    return { ok: false, error: `responseMode invalide (allowed: ${WA_PROTOCOL_RESPONSE_MODES.join(", ")})` };

  const gillesMode = typeof b.gillesInstructionMode === "string" ? b.gillesInstructionMode : "draft_before_send";
  if (!WA_PROTOCOL_GILLES_INSTRUCTION_MODES.includes(gillesMode as WaProtocolGillesInstructionMode))
    return {
      ok: false,
      error: `gillesInstructionMode invalide (allowed: ${WA_PROTOCOL_GILLES_INSTRUCTION_MODES.join(", ")})`,
    };

  const status = typeof b.status === "string" ? b.status : "active";
  if (!WA_PROTOCOL_STATUSES.includes(status as WaProtocolStatus))
    return { ok: false, error: `status invalide (allowed: ${WA_PROTOCOL_STATUSES.join(", ")})` };

  return {
    ok: true,
    data: {
      jid: b.jid.trim(),
      groupName: b.groupName.trim(),
      tenantSlug: b.tenantSlug.trim(),
      agentSlug: typeof b.agentSlug === "string" && b.agentSlug.trim() ? b.agentSlug.trim() : "lea",
      category: category as WaProtocolCategory,
      responseMode: responseMode as WaProtocolResponseMode,
      gillesInstructionMode: gillesMode as WaProtocolGillesInstructionMode,
      status: status as WaProtocolStatus,
      operationalScope: typeof b.operationalScope === "string" ? b.operationalScope : "",
      protocolText: typeof b.protocolText === "string" ? b.protocolText : "",
      notes: typeof b.notes === "string" ? b.notes : null,
    },
  };
}

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body json invalide" }, { status: 400, headers: NO_STORE });
  }
  const v = validateCreate(body);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400, headers: NO_STORE });
  const d = v.data;

  try {
    const inserted = await adminQuery<Row>(
      `INSERT INTO core.whatsapp_protocols
         (jid, group_name, tenant_slug, agent_slug,
          category, response_mode, gilles_instruction_mode, status,
          operational_scope, protocol_text, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING ${SELECT_COLS}`,
      [
        d.jid,
        d.groupName,
        d.tenantSlug,
        d.agentSlug,
        d.category,
        d.responseMode,
        d.gillesInstructionMode,
        d.status,
        d.operationalScope,
        d.protocolText,
        d.notes,
      ]
    );
    return Response.json({ item: mapRow(inserted[0]) }, { status: 201, headers: NO_STORE });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur DB";
    const status = /unique|duplicate/i.test(msg) ? 409 : 502;
    const error = status === 409 ? "JID déjà utilisé pour un autre protocole" : msg;
    return Response.json({ error }, { status, headers: NO_STORE });
  }
}
