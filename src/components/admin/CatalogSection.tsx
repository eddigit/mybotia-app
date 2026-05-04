"use client";

// Bloc 7B — section Catalogue produits/services dans /admin/tenants/[slug].
// Visible uniquement si architectureConfig.standardModules.catalog=true,
// sinon affiche un bandeau d'information.

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, AlertCircle, Package, ShoppingBag } from "lucide-react";
import {
  type CatalogItem,
  type CatalogItemType,
  type CatalogItemUnit,
  CATALOG_ITEM_TYPES,
  CATALOG_ITEM_UNITS,
  TYPE_LABEL,
  UNIT_LABEL,
} from "@/lib/catalog-types";

interface Props {
  tenantSlug: string;
  catalogEnabled: boolean;
}

export function CatalogSection({ tenantSlug, catalogEnabled }: Props) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/catalog?tenant=${encodeURIComponent(tenantSlug)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => setItems(j.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [tenantSlug]);

  const totals = useMemo(() => {
    const active = items.filter((i) => i.active);
    const byType = active.reduce<Record<string, number>>((acc, i) => {
      acc[i.type] = (acc[i.type] || 0) + 1;
      return acc;
    }, {});
    return { total: items.length, active: active.length, byType };
  }, [items]);

  return (
    <section className="card-sharp p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-accent-glow" />
          <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
            Catalogue produits & services
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreate(true);
            setError(null);
            setSuccess(null);
          }}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20"
        >
          <Plus className="w-3 h-3" />
          Nouvel item
        </button>
      </div>

      {!catalogEnabled && (
        <div className="flex items-start gap-1.5 text-[11px] text-amber-300 bg-amber-400/10 border border-amber-400/30 px-3 py-2 mb-4">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            <span className="font-bold uppercase tracking-wider">Catalogue non déclaré</span>{" "}
            dans l&apos;architecture du tenant.
            Pour activer pleinement, coche{" "}
            <span className="font-mono">standardModules.catalog</span>{" "}
            dans la section Architecture ci-dessus. Tu peux quand même créer
            des items en superadmin.
          </span>
        </div>
      )}

      <div className="text-[11px] text-text-muted mb-4 italic">
        Catalogue cockpit. Pas encore synchronisé avec Dolibarr — la
        synchronisation viendra dans un bloc futur. Les workflows spécifiques
        (modèles facturation, règles métier) sont du custom facturable.
      </div>

      {/* Totaux */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <Total label="Items total" value={String(totals.total)} accent />
        <Total label="Actifs" value={String(totals.active)} />
        <Total label="Services" value={String(totals.byType.service || 0)} />
        <Total label="Abonnements" value={String(totals.byType.subscription || 0)} />
        <Total label="Produits" value={String(totals.byType.product || 0)} />
      </div>

      {/* Etat */}
      {error && (
        <div className="flex items-start gap-1.5 text-[11px] text-status-danger mb-3">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && <div className="text-[11px] text-emerald-300 mb-3">{success}</div>}

      {/* Form create */}
      {showCreate && (
        <CreateForm
          tenantSlug={tenantSlug}
          onCancel={() => setShowCreate(false)}
          onCreated={(item) => {
            setItems((prev) => [item, ...prev]);
            setShowCreate(false);
            setSuccess(`Item "${item.name}" créé.`);
          }}
        />
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-accent-glow" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-text-muted italic text-center py-6">
          Aucun item dans le catalogue de ce tenant.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
              <tr>
                <th className="text-left py-2 px-2">SKU / Nom</th>
                <th className="text-left py-2 px-2">Type</th>
                <th className="text-left py-2 px-2">Catégorie</th>
                <th className="text-right py-2 px-2">Prix HT</th>
                <th className="text-right py-2 px-2">TVA</th>
                <th className="text-left py-2 px-2">Unité</th>
                <th className="text-center py-2 px-2">Actif</th>
                <th className="text-center py-2 px-2">Devis</th>
                <th className="text-center py-2 px-2">IA</th>
                <th className="text-right py-2 px-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onUpdated={(updated) => {
                    setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                    setSuccess(`Item "${updated.name}" mis à jour.`);
                  }}
                  onError={(msg) => setError(msg)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Total({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`p-3 border ${accent ? "border-accent-primary/30 bg-accent-primary/5" : "border-border-subtle bg-surface-2/50"}`}>
      <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className={`text-sm font-bold mt-1 ${accent ? "text-accent-glow" : "text-text-primary"}`}>
        {value}
      </p>
    </div>
  );
}

function ItemRow({
  item,
  onUpdated,
  onError,
}: {
  item: CatalogItem;
  onUpdated: (i: CatalogItem) => void;
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    name: item.name,
    priceHt: item.priceHt,
    vatRate: item.vatRate,
    active: item.active,
    visibleInQuotes: item.visibleInQuotes,
    visibleToAi: item.visibleToAi,
  });

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/catalog/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      onUpdated(j.item);
      setEditing(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className={`hover:bg-surface-2/40 ${!item.active ? "opacity-60" : ""}`}>
      <td className="py-2 px-2">
        {editing ? (
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="w-full bg-surface-2 border border-border-subtle px-2 py-1"
          />
        ) : (
          <div>
            <p className="text-text-primary font-semibold truncate">{item.name}</p>
            {item.sku && (
              <p className="text-text-muted text-[10px] font-mono">{item.sku}</p>
            )}
          </div>
        )}
      </td>
      <td className="py-2 px-2 text-text-muted text-[10px]">{TYPE_LABEL[item.type]}</td>
      <td className="py-2 px-2 text-text-muted text-[10px]">{item.category || "—"}</td>
      <td className="py-2 px-2 text-right font-mono text-text-primary">
        {editing ? (
          <input
            type="number"
            step="0.01"
            min="0"
            value={draft.priceHt}
            onChange={(e) =>
              setDraft((d) => ({ ...d, priceHt: parseFloat(e.target.value) || 0 }))
            }
            className="w-20 text-right bg-surface-2 border border-border-subtle px-2 py-1"
          />
        ) : (
          `${Number(item.priceHt).toLocaleString("fr-FR")} ${item.currency}`
        )}
      </td>
      <td className="py-2 px-2 text-right text-text-muted">
        {editing ? (
          <input
            type="number"
            step="0.01"
            min="0"
            value={draft.vatRate}
            onChange={(e) =>
              setDraft((d) => ({ ...d, vatRate: parseFloat(e.target.value) || 0 }))
            }
            className="w-16 text-right bg-surface-2 border border-border-subtle px-2 py-1"
          />
        ) : (
          `${item.vatRate}%`
        )}
      </td>
      <td className="py-2 px-2 text-text-muted text-[10px]">{UNIT_LABEL[item.unit]}</td>
      <td className="py-2 px-2 text-center">
        {editing ? (
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
            className="accent-accent-primary"
          />
        ) : item.active ? (
          <span className="text-emerald-300">✓</span>
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </td>
      <td className="py-2 px-2 text-center">
        {editing ? (
          <input
            type="checkbox"
            checked={draft.visibleInQuotes}
            onChange={(e) => setDraft((d) => ({ ...d, visibleInQuotes: e.target.checked }))}
            className="accent-accent-primary"
          />
        ) : item.visibleInQuotes ? (
          <span className="text-emerald-300">✓</span>
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </td>
      <td className="py-2 px-2 text-center">
        {editing ? (
          <input
            type="checkbox"
            checked={draft.visibleToAi}
            onChange={(e) => setDraft((d) => ({ ...d, visibleToAi: e.target.checked }))}
            className="accent-accent-primary"
          />
        ) : item.visibleToAi ? (
          <span className="text-emerald-300">✓</span>
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </td>
      <td className="py-2 px-2 text-right">
        {editing ? (
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1 text-accent-glow text-[10px] hover:underline"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {saving ? "..." : "Enregistrer"}
          </button>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-accent-glow text-[10px] hover:underline"
          >
            Modifier
          </button>
        )}
      </td>
    </tr>
  );
}

function CreateForm({
  tenantSlug,
  onCancel,
  onCreated,
}: {
  tenantSlug: string;
  onCancel: () => void;
  onCreated: (i: CatalogItem) => void;
}) {
  const [form, setForm] = useState({
    sku: "",
    name: "",
    description: "",
    category: "",
    type: "service" as CatalogItemType,
    unit: "month" as CatalogItemUnit,
    priceHt: 0,
    vatRate: 20,
    currency: "EUR",
    visibleInQuotes: true,
    visibleToAi: true,
    requiresAdminValidation: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { ...form, tenantSlug };
      if (!form.sku) delete payload.sku;
      if (!form.description) delete payload.description;
      if (!form.category) delete payload.category;
      const res = await fetch("/api/admin/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      onCreated(j.item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="border border-accent-primary/30 bg-accent-primary/5 p-4 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs"
    >
      <Field label="SKU (optionnel)">
        <input
          type="text"
          value={form.sku}
          onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
          placeholder="MYB-LEA-MONTHLY"
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 font-mono"
        />
      </Field>
      <Field label="Nom *">
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Collaborateur IA Léa"
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5"
        />
      </Field>
      <Field label="Type">
        <select
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CatalogItemType }))}
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5"
        >
          {CATALOG_ITEM_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Unité">
        <select
          value={form.unit}
          onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as CatalogItemUnit }))}
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5"
        >
          {CATALOG_ITEM_UNITS.map((u) => (
            <option key={u} value={u}>
              {UNIT_LABEL[u]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Catégorie">
        <input
          type="text"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          placeholder="agents_ia / setup / hébergement..."
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5"
        />
      </Field>
      <Field label="Devise">
        <input
          type="text"
          value={form.currency}
          onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5"
        />
      </Field>
      <Field label="Prix HT">
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.priceHt}
          onChange={(e) => setForm((f) => ({ ...f, priceHt: parseFloat(e.target.value) || 0 }))}
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5"
        />
      </Field>
      <Field label="TVA (%)">
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.vatRate}
          onChange={(e) => setForm((f) => ({ ...f, vatRate: parseFloat(e.target.value) || 0 }))}
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5"
        />
      </Field>
      <Field label="Description" className="md:col-span-2">
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={2}
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5"
        />
      </Field>
      <div className="md:col-span-2 flex flex-wrap gap-3 text-[11px]">
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={form.visibleInQuotes}
            onChange={(e) => setForm((f) => ({ ...f, visibleInQuotes: e.target.checked }))}
            className="accent-accent-primary"
          />
          Visible dans les devis
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={form.visibleToAi}
            onChange={(e) => setForm((f) => ({ ...f, visibleToAi: e.target.checked }))}
            className="accent-accent-primary"
          />
          Visible à l&apos;IA
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={form.requiresAdminValidation}
            onChange={(e) =>
              setForm((f) => ({ ...f, requiresAdminValidation: e.target.checked }))
            }
            className="accent-accent-primary"
          />
          Validation admin requise
        </label>
      </div>
      {error && (
        <div className="md:col-span-2 text-[11px] text-status-danger flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <div className="md:col-span-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight text-text-muted hover:text-text-primary"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
          Créer
        </button>
      </div>
    </form>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className || ""}`}>
      <span className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">{label}</span>
      {children}
    </label>
  );
}
