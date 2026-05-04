"use client";

// LEA-WA-PROTOCOLS-MVP-ADMIN — page admin protocoles WhatsApp.
// Superadmin only. Aucun appel WhatsApp, aucun envoi, aucun runtime branché.

import { useEffect, useMemo, useState } from "react";
import {
  MessageSquare,
  Plus,
  AlertCircle,
  Loader2,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import {
  WA_PROTOCOL_CATEGORIES,
  WA_PROTOCOL_GILLES_INSTRUCTION_MODES,
  WA_PROTOCOL_RESPONSE_MODES,
  WA_PROTOCOL_STATUSES,
  WA_CATEGORY_LABEL,
  WA_CATEGORY_HELP,
  WA_GILLES_MODE_LABEL,
  WA_RESPONSE_MODE_HELP,
  WA_RESPONSE_MODE_LABEL,
  WA_STATUS_LABEL,
  type WaProtocolCategory,
  type WaProtocolGillesInstructionMode,
  type WaProtocolResponseMode,
  type WaProtocolStatus,
  type WhatsappProtocol,
} from "@/lib/whatsapp-protocol-types";

const HELP_TEXT_PROTOCOL =
  "Le protocole du groupe fixe le cadre permanent. Les instructions de Gilles peuvent piloter Léa ponctuellement, mais Léa doit toujours lire le protocole du JID avant d'agir.";
const HELP_TEXT_OPERATIONAL =
  "Léa peut exécuter les actions opérationnelles autorisées. Elle ne décide jamais seule des prix, devis, délais fermes, engagements ou sujets sensibles.";

export default function WhatsappProtocolsPage() {
  const [items, setItems] = useState<WhatsappProtocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetch("/api/admin/whatsapp-protocols")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => setItems(j.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const totals = useMemo(() => {
    const active = items.filter((i) => i.status === "active");
    return { total: items.length, active: active.length };
  }, [items]);

  const editing = items.find((i) => i.id === editingId) || null;

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce protocole ? L'action est irréversible.")) return;
    setError(null);
    try {
      const r = await fetch(`/api/admin/whatsapp-protocols/${id}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <div className="p-8 min-h-screen space-y-6">
      <ModuleHeader
        icon={MessageSquare}
        title="Protocoles WhatsApp"
        subtitle={`${totals.active} actifs · ${totals.total} au total`}
        actions={
          <button
            type="button"
            onClick={() => {
              setShowCreate(true);
              setEditingId(null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20"
          >
            <Plus className="w-3 h-3" />
            Nouveau protocole
          </button>
        }
      />

      {/* Bandeaux d'aide doctrine */}
      <div className="space-y-2">
        <div className="flex items-start gap-2 p-3 border border-amber-400/30 bg-amber-400/10 text-[11px] text-amber-300">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{HELP_TEXT_PROTOCOL}</span>
        </div>
        <div className="flex items-start gap-2 p-3 border border-amber-400/30 bg-amber-400/10 text-[11px] text-amber-300">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{HELP_TEXT_OPERATIONAL}</span>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 border border-status-danger/30 bg-status-danger/10 text-status-danger text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {(showCreate || editing) && (
        <ProtocolForm
          initial={editing}
          onCancel={() => {
            setShowCreate(false);
            setEditingId(null);
          }}
          onSaved={() => {
            setShowCreate(false);
            setEditingId(null);
            load();
          }}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
        </div>
      ) : items.length === 0 ? (
        <div className="card-sharp p-12">
          <p className="text-xs text-text-muted italic text-center">
            Aucun protocole défini. Cliquez sur &quot;Nouveau protocole&quot; pour commencer.
          </p>
        </div>
      ) : (
        <section className="card-sharp p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left py-2 px-2">Groupe / JID</th>
                  <th className="text-left py-2 px-2">Tenant / Agent</th>
                  <th className="text-left py-2 px-2">Catégorie</th>
                  <th className="text-left py-2 px-2">Mode réponse</th>
                  <th className="text-left py-2 px-2">Mode Gilles</th>
                  <th className="text-center py-2 px-2">Statut</th>
                  <th className="text-right py-2 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {items.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-2/40">
                    <td className="py-2 px-2">
                      <div className="text-text-primary">{p.groupName}</div>
                      <div className="text-text-muted font-mono text-[10px] truncate max-w-[18rem]">{p.jid}</div>
                    </td>
                    <td className="py-2 px-2 text-text-secondary">
                      <span className="font-mono">{p.tenantSlug}</span>
                      <span className="text-text-muted"> · </span>
                      <span>{p.agentSlug}</span>
                    </td>
                    <td className="py-2 px-2 text-text-secondary">{WA_CATEGORY_LABEL[p.category]}</td>
                    <td className="py-2 px-2">
                      <ResponseModeChip mode={p.responseMode} />
                    </td>
                    <td className="py-2 px-2 text-text-muted text-[10px]">
                      {WA_GILLES_MODE_LABEL[p.gillesInstructionMode]}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <StatusChip status={p.status} />
                    </td>
                    <td className="py-2 px-2 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingId(p.id);
                          setShowCreate(false);
                        }}
                        className="text-accent-glow text-[10px] hover:underline"
                      >
                        modifier
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-status-danger text-[10px] hover:underline"
                      >
                        <Trash2 className="w-3 h-3 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function ProtocolForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: WhatsappProtocol | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [jid, setJid] = useState(initial?.jid || "");
  const [groupName, setGroupName] = useState(initial?.groupName || "");
  const [tenantSlug, setTenantSlug] = useState(initial?.tenantSlug || "mybotia");
  const [agentSlug, setAgentSlug] = useState(initial?.agentSlug || "lea");
  const [category, setCategory] = useState<WaProtocolCategory>(initial?.category || "support_client");
  const [responseMode, setResponseMode] = useState<WaProtocolResponseMode>(initial?.responseMode || "draft_only");
  const [gillesMode, setGillesMode] = useState<WaProtocolGillesInstructionMode>(
    initial?.gillesInstructionMode || "draft_before_send"
  );
  const [status, setStatus] = useState<WaProtocolStatus>(initial?.status || "active");
  const [operationalScope, setOperationalScope] = useState(initial?.operationalScope || "");
  const [protocolText, setProtocolText] = useState(initial?.protocolText || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        jid: jid.trim(),
        groupName: groupName.trim(),
        tenantSlug: tenantSlug.trim(),
        agentSlug: agentSlug.trim(),
        category,
        responseMode,
        gillesInstructionMode: gillesMode,
        status,
        operationalScope,
        protocolText,
        notes: notes.trim() || null,
      };
      const url = isEdit
        ? `/api/admin/whatsapp-protocols/${initial!.id}`
        : "/api/admin/whatsapp-protocols";
      const method = isEdit ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card-sharp p-6 border-l-4 border-accent-primary">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold uppercase tracking-tight text-accent-glow font-headline">
          {isEdit ? `Modifier · ${initial!.groupName}` : "Nouveau protocole WhatsApp"}
        </h2>
        <button onClick={onCancel} className="text-text-muted hover:text-text-primary">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs mb-3">
        <Field label="Nom du groupe *">
          <input value={groupName} onChange={(e) => setGroupName(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="JID WhatsApp *">
          <input value={jid} onChange={(e) => setJid(e.target.value)} placeholder="120363xxx@g.us" className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label="Tenant *">
          <input value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label="Agent *">
          <input value={agentSlug} onChange={(e) => setAgentSlug(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label="Catégorie">
          <select value={category} onChange={(e) => setCategory(e.target.value as WaProtocolCategory)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1">
            {WA_PROTOCOL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{WA_CATEGORY_LABEL[c]}</option>
            ))}
          </select>
          <p className="text-[10px] text-text-muted mt-1 italic">{WA_CATEGORY_HELP[category]}</p>
        </Field>
        <Field label="Statut">
          <select value={status} onChange={(e) => setStatus(e.target.value as WaProtocolStatus)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1">
            {WA_PROTOCOL_STATUSES.map((s) => (
              <option key={s} value={s}>{WA_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Mode de réponse">
        <select value={responseMode} onChange={(e) => setResponseMode(e.target.value as WaProtocolResponseMode)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 text-xs">
          {WA_PROTOCOL_RESPONSE_MODES.map((m) => (
            <option key={m} value={m}>{WA_RESPONSE_MODE_LABEL[m]}</option>
          ))}
        </select>
        <p className="text-[10px] text-text-muted mt-1 italic">{WA_RESPONSE_MODE_HELP[responseMode]}</p>
      </Field>

      <Field label="Mode instruction Gilles">
        <select value={gillesMode} onChange={(e) => setGillesMode(e.target.value as WaProtocolGillesInstructionMode)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 text-xs">
          {WA_PROTOCOL_GILLES_INSTRUCTION_MODES.map((m) => (
            <option key={m} value={m}>{WA_GILLES_MODE_LABEL[m]}</option>
          ))}
        </select>
      </Field>

      <Field label="Périmètre opérationnel autorisé">
        <textarea
          value={operationalScope}
          onChange={(e) => setOperationalScope(e.target.value)}
          rows={4}
          placeholder="Décrire ici ce que Léa peut faire dans ce groupe : support site, rédaction, CRM, relance projet, cahier des charges, GitHub, Vercel, documents, etc."
          className="w-full bg-surface-2 border border-border-subtle px-2 py-2 text-xs resize-vertical"
        />
        <p className="text-[10px] text-text-muted mt-1 italic">
          Décrire ici ce que Léa peut faire dans ce groupe : support site, rédaction, CRM, relance
          projet, cahier des charges, GitHub, Vercel, documents, etc. Léa lit ce champ avant
          d&apos;agir.
        </p>
      </Field>

      <Field label="Protocole (texte libre)">
        <textarea
          value={protocolText}
          onChange={(e) => setProtocolText(e.target.value)}
          rows={10}
          placeholder="Cadre permanent. Périmètres autorisés / interdits. Postures attendues. Exemples de réponses."
          className="w-full bg-surface-2 border border-border-subtle px-2 py-2 text-xs font-mono resize-vertical"
        />
      </Field>

      <Field label="Notes internes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Mémo opérateur. Non lu par Léa runtime."
          className="w-full bg-surface-2 border border-border-subtle px-2 py-2 text-xs resize-vertical"
        />
      </Field>

      {err && (
        <div className="text-[11px] text-status-danger flex items-start gap-1 mb-2">
          <AlertCircle className="w-3 h-3 mt-0.5" />
          <span>{err}</span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-3">
        <button onClick={onCancel} className="px-3 py-1.5 text-[10px] uppercase border border-border-subtle text-text-muted hover:text-text-primary">
          Annuler
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !jid.trim() || !groupName.trim() || !tenantSlug.trim() || !agentSlug.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase border border-accent-primary/30 bg-accent-primary/20 text-accent-glow hover:bg-accent-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </section>
  );
}

function ResponseModeChip({ mode }: { mode: WaProtocolResponseMode }) {
  const cls =
    mode === "operational_autonomous" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : mode === "auto_safe" ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
    : mode === "draft_only" ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
    : mode === "silent" ? "bg-text-muted/15 text-text-muted border-border-subtle"
    : "bg-status-danger/15 text-status-danger border-status-danger/30";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase border ${cls}`}>
      {WA_RESPONSE_MODE_LABEL[mode]}
    </span>
  );
}

function StatusChip({ status }: { status: WaProtocolStatus }) {
  const cls =
    status === "active"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : "bg-text-muted/15 text-text-muted border-border-subtle";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase border ${cls}`}>
      {WA_STATUS_LABEL[status]}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="text-[10px] uppercase text-text-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
