import { BarChart3, Plus } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { ClientCard } from "@/components/crm/ClientCard";
import { Pipeline } from "@/components/crm/Pipeline";
import { clients, deals } from "@/data/mock";
import { formatCurrency } from "@/lib/utils";

export default function CRMPage() {
  const totalRevenue = clients.reduce((sum, c) => sum + (c.revenue || 0), 0);
  const activeClients = clients.filter((c) => c.status === 'active').length;
  const pipelineValue = deals.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <ModuleHeader
        icon={BarChart3}
        title="CRM / Activite"
        subtitle={`${clients.length} contacts · ${formatCurrency(totalRevenue)} revenu annuel`}
        actions={
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary/90 transition-all">
            <Plus className="w-3.5 h-3.5" />
            Nouveau contact
          </button>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Clients actifs', value: activeClients.toString(), color: 'text-emerald-400' },
          { label: 'Pipeline', value: formatCurrency(pipelineValue), color: 'text-amber-400' },
          { label: 'Taux conversion', value: '23%', color: 'text-blue-400' },
          { label: 'Deals en cours', value: deals.length.toString(), color: 'text-violet-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="glass-card p-4">
            <span className="text-xs text-text-muted">{kpi.label}</span>
            <p className={`text-xl font-semibold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <Pipeline deals={deals} />

      {/* Clients grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">Contacts</h3>
          <div className="flex gap-1">
            {['Tous', 'Actifs', 'Prospects', 'Onboarding'].map((filter) => (
              <button
                key={filter}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  filter === 'Tous'
                    ? "bg-accent-primary/10 text-accent-glow"
                    : "text-text-muted hover:text-text-secondary hover:bg-white/[0.03]"
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
