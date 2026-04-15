import { BarChart3, Plus } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { ClientCard } from "@/components/crm/ClientCard";
import { Pipeline } from "@/components/crm/Pipeline";
import { clients, deals } from "@/data/mock";
import { formatCurrency } from "@/lib/utils";

export default function CRMPage() {
  const totalRevenue = clients.reduce((sum, c) => sum + (c.revenue || 0), 0);
  const pipelineValue = deals.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="p-8 space-y-8">
      <ModuleHeader
        icon={BarChart3}
        title="CRM / Activite"
        subtitle={`${clients.length} contacts · ${formatCurrency(totalRevenue)} revenu annuel`}
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
          { label: 'Clients actifs', value: clients.filter(c => c.status === 'active').length.toString(), sub: 'en portefeuille' },
          { label: 'Pipeline', value: formatCurrency(pipelineValue), sub: `${deals.length} opportunites` },
          { label: 'Taux conversion', value: '23%', sub: 'sur 90 jours' },
          { label: 'Revenu moyen', value: formatCurrency(Math.round(totalRevenue / clients.length)), sub: 'par client' },
        ].map((kpi) => (
          <div key={kpi.label} className="card-sharp-high p-5">
            <span className="micro-label text-text-muted">{kpi.label}</span>
            <p className="text-2xl font-headline font-extrabold text-text-primary mt-2">{kpi.value}</p>
            <p className="text-[10px] text-text-muted mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <Pipeline deals={deals} />

      {/* Clients grid */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h3 className="section-header text-sm font-bold tracking-tight uppercase text-text-primary font-headline">
            Contacts
          </h3>
          <div className="flex gap-1 bg-surface-1 p-1 rounded-sm">
            {['Tous', 'Actifs', 'Prospects', 'Onboarding'].map((filter) => (
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
