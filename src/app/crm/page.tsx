"use client";

import { useState } from "react";
import { BarChart3, Plus, Loader2 } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import {
  FormModal,
  FormField,
  inputClass,
  selectClass,
  btnPrimary,
  btnSecondary,
} from "@/components/shared/FormModal";
import { ClientCard } from "@/components/crm/ClientCard";
import { Pipeline } from "@/components/crm/Pipeline";
import { useClients, useDashboard } from "@/hooks/use-api";
import { formatCurrency } from "@/lib/utils";

type FilterKey = "all" | "active" | "prospect" | "churned" | "supplier";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "active", label: "Actifs" },
  { key: "prospect", label: "Prospects" },
  { key: "supplier", label: "Fournisseurs" },
  { key: "churned", label: "Inactifs" },
];

export default function CRMPage() {
  const { data: clients, loading: clientsLoading, refetch: refetchClients } = useClients();
  const { data: dashboard, loading: dashboardLoading } = useDashboard();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const loading = clientsLoading || dashboardLoading;
  const deals = dashboard?.deals ?? [];
  const pipelineValue = deals.reduce((sum, d) => sum + d.value, 0);

  const filteredClients = clients.filter((c) => {
    if (filter === "all") return true;
    if (filter === "supplier") return c.isSupplier;
    return c.status === filter;
  });

  const activeCount = clients.filter((c) => c.status === "active").length;
  const prospectCount = clients.filter((c) => c.status === "prospect").length;
  const supplierCount = clients.filter((c) => c.isSupplier).length;

  async function handleCreateClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          name_alias: form.get("name_alias"),
          email: form.get("email"),
          phone: form.get("phone"),
          town: form.get("town"),
          client: form.get("type") === "client" ? "1" : "0",
          prospect: form.get("type") === "prospect" ? "1" : "0",
          fournisseur: form.get("type") === "fournisseur" ? "1" : "0",
          note_public: form.get("note_public"),
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        refetchClients();
      }
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted micro-label">Chargement du CRM...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <ModuleHeader
        icon={BarChart3}
        title="CRM / Activite"
        subtitle={`${clients.length} tiers · ${formatCurrency(pipelineValue)} pipeline`}
        actions={
          <button onClick={() => setShowCreate(true)} className={btnPrimary}>
            <Plus className="w-3.5 h-3.5" />
            Nouveau tiers
          </button>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Clients actifs", value: activeCount.toString(), sub: "en portefeuille" },
          { label: "Pipeline", value: formatCurrency(pipelineValue), sub: `${deals.length} opportunites` },
          { label: "Prospects", value: prospectCount.toString(), sub: "en attente" },
          { label: "Fournisseurs", value: supplierCount.toString(), sub: "dans Dolibarr" },
        ].map((kpi) => (
          <div key={kpi.label} className="card-sharp-high p-5">
            <span className="micro-label text-text-muted">{kpi.label}</span>
            <p className="text-2xl font-headline font-extrabold text-text-primary mt-2">{kpi.value}</p>
            <p className="text-[10px] text-text-muted mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {deals.length > 0 && <Pipeline deals={deals} />}

      {/* Clients grid */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h3 className="section-header text-sm font-bold tracking-tight uppercase text-text-primary font-headline">
            Tiers ({filteredClients.length})
          </h3>
          <div className="flex gap-1 bg-surface-1 p-1 rounded-sm">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight rounded-sm transition-all ${
                  filter === f.key
                    ? "bg-accent-primary/10 text-accent-glow"
                    : "text-text-muted hover:bg-surface-3/50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      </div>

      {/* Create client modal */}
      <FormModal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau tiers">
        <form onSubmit={handleCreateClient}>
          <FormField label="Nom de la societe *">
            <input name="name" required className={inputClass} placeholder="Ex: Cabinet Martin & Associes" />
          </FormField>
          <FormField label="Alias / nom court">
            <input name="name_alias" className={inputClass} placeholder="Ex: Martin" />
          </FormField>
          <FormField label="Type">
            <select name="type" className={selectClass} defaultValue="client">
              <option value="client">Client</option>
              <option value="prospect">Prospect</option>
              <option value="fournisseur">Fournisseur</option>
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Email">
              <input name="email" type="email" className={inputClass} placeholder="contact@..." />
            </FormField>
            <FormField label="Telephone">
              <input name="phone" className={inputClass} placeholder="+33 6..." />
            </FormField>
          </div>
          <FormField label="Ville">
            <input name="town" className={inputClass} placeholder="Paris" />
          </FormField>
          <FormField label="Note">
            <textarea name="note_public" className={inputClass} rows={2} placeholder="Notes..." />
          </FormField>
          <div className="flex items-center justify-end gap-3 mt-6">
            <button type="button" onClick={() => setShowCreate(false)} className={btnSecondary}>Annuler</button>
            <button type="submit" disabled={creating} className={btnPrimary}>
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Creer
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}
