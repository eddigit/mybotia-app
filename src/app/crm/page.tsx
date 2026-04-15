"use client";

import { BarChart3, Plus } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { ClientCard } from "@/components/crm/ClientCard";
import { Pipeline } from "@/components/crm/Pipeline";
import { useClients, useDashboard } from "@/hooks/use-api";
import { formatCurrency } from "@/lib/utils";

export default function CRMPage() {
  const { data: clients, loading: clientsLoading } = useClients();
  const { data: dashboard, loading: dashboardLoading } = useDashboard();

  const loading = clientsLoading || dashboardLoading;
  const deals = dashboard?.deals ?? [];
  const pipelineValue = deals.reduce((sum, d) => sum + d.value, 0);
  const activeClients = clients.filter(c => c.status === 'active');

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
        subtitle={`${clients.length} contacts · ${formatCurrency(pipelineValue)} pipeline`}
        actions={
          <button className="flex items-center gap-2 px-4 py-2.5 bg-accent-primary text-white text-xs font-bold uppercase tracking-widest hover:bg-accent-primary/80 transition-all">
            <Plus className="w-3.5 h-3.5" />
            Nouveau contact
          </button>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Clients actifs', value: activeClients.length.toString(), sub: 'en portefeuille' },
          { label: 'Pipeline', value: formatCurrency(pipelineValue), sub: `${deals.length} opportunites` },
          { label: 'Prospects', value: clients.filter(c => c.status === 'prospect').length.toString(), sub: 'en attente' },
          { label: 'Total contacts', value: clients.length.toString(), sub: 'dans Dolibarr' },
        ].map((kpi) => (
          <div key={kpi.label} className="card-sharp-high p-5">
            <span className="micro-label text-text-muted">{kpi.label}</span>
            <p className="text-2xl font-headline font-extrabold text-text-primary mt-2">{kpi.value}</p>
            <p className="text-[10px] text-text-muted mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      {deals.length > 0 && <Pipeline deals={deals} />}

      {/* Clients grid */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h3 className="section-header text-sm font-bold tracking-tight uppercase text-text-primary font-headline">
            Contacts
          </h3>
          <div className="flex gap-1 bg-surface-1 p-1 rounded-sm">
            {['Tous', 'Actifs', 'Prospects'].map((filter) => (
              <button
                key={filter}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight rounded-sm transition-all ${
                  filter === 'Tous'
                    ? "bg-accent-primary/10 text-accent-glow"
                    : "text-text-muted hover:bg-surface-3/50"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      </div>
    </div>
  );
}
