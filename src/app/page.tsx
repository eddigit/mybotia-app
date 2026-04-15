import { CommandCenterHero } from "@/components/home/CommandCenterHero";
import { MetricCard } from "@/components/shared/MetricCard";
import { ActivityFeed } from "@/components/home/ActivityFeed";
import { QuickActions } from "@/components/home/QuickActions";
import { InsightCard } from "@/components/home/InsightCard";
import { AgentStatusGrid } from "@/components/home/AgentStatusGrid";
import { ProjectProgress } from "@/components/home/ProjectProgress";
import { metrics, activities, insights, agents, projects } from "@/data/mock";

export default function HomePage() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Hero */}
      <CommandCenterHero />

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <MetricCard key={m.id} metric={m} />
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Activity + Insights */}
        <div className="lg:col-span-2 space-y-6">
          <ActivityFeed activities={activities} />
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Recommandations IA</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          </div>
        </div>

        {/* Right column — Agents + Projects + Quick actions */}
        <div className="space-y-6">
          <AgentStatusGrid agents={agents} />
          <ProjectProgress projects={projects} />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
