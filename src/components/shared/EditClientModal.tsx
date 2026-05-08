"use client";

// V1.1.B Phase 2 A4 — Modal d'édition client.
// PATCH /api/clients/[id] (Platform → crm-router → mybotia-business).
// Champs métier minimaux V1 : name, email, phone, status, notes.

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  FormModal,
  FormField,
  inputClass,
  selectClass,
  btnPrimary,
  btnSecondary,
} from "./FormModal";
import type { Client } from "@/types";

const STATUS_OPTIONS = [
  { value: "active", label: "Client actif" },
  { value: "prospect", label: "Prospect" },
  { value: "churned", label: "Churned" },
];

export function EditClientModal({
  open,
  onClose,
  onSaved,
  client,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  client: Client | null;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!client) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!client) return;
    setSaving(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const body: Record<string, string | null> = {
      name: String(form.get("name") || "").trim(),
      email: String(form.get("email") || "").trim() || null,
      phone: String(form.get("phone") || "").trim() || null,
      status: String(form.get("status") || "active"),
      notes: String(form.get("notes") || "").trim() || null,
      // V1.1.B agence digitale
      clientType: String(form.get("clientType") || "").trim() || null,
      priority: String(form.get("priority") || "").trim() || null,
      whatsappJid: String(form.get("whatsappJid") || "").trim() || null,
    };
    if (!body.name) {
      setError("Le nom est requis.");
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(client.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || `Erreur (${res.status})`);
        return;
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal open={open} onClose={onClose} title="Modifier le client">
      <form onSubmit={handleSubmit}>
        <FormField label="Nom *">
          <input
            name="name"
            required
            defaultValue={client.name || client.company || ""}
            className={inputClass}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Email">
            <input
              name="email"
              type="email"
              defaultValue={client.email || ""}
              className={inputClass}
            />
          </FormField>
          <FormField label="Téléphone">
            <input
              name="phone"
              defaultValue={client.phone || ""}
              className={inputClass}
            />
          </FormField>
        </div>

        <FormField label="Statut">
          <select
            name="status"
            defaultValue={client.status || "active"}
            className={selectClass}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Notes">
          <textarea
            name="notes"
            rows={3}
            defaultValue={client.notePublic || ""}
            className={inputClass}
          />
        </FormField>

        {/* V1.1.B agence digitale */}
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Type">
            <select name="clientType" defaultValue={client.clientType ?? ""} className={selectClass}>
              <option value="">—</option>
              <option value="site_web">Site web</option>
              <option value="ia">Collaborateur IA</option>
              <option value="maintenance">Maintenance</option>
              <option value="autre">Autre</option>
            </select>
          </FormField>
          <FormField label="Priorité">
            <select name="priority" defaultValue={client.priority ?? ""} className={selectClass}>
              <option value="">—</option>
              <option value="normale">Normale</option>
              <option value="haute">Haute</option>
              <option value="vip">VIP</option>
            </select>
          </FormField>
        </div>

        <FormField label="WhatsApp (JID)">
          <input
            name="whatsappJid"
            defaultValue={client.whatsappJid ?? ""}
            placeholder="33612345678@s.whatsapp.net"
            className={inputClass}
          />
        </FormField>

        {error ? (
          <p className="mt-2 text-sm text-red-400">{error}</p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Annuler
          </button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Enregistrer
          </button>
        </div>
      </form>
    </FormModal>
  );
}
