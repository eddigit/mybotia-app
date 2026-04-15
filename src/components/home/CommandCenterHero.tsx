import { CalendarDays, Sparkles } from "lucide-react";

export function CommandCenterHero() {
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Bonjour" : now.getHours() < 18 ? "Bon apres-midi" : "Bonsoir";
  const dateStr = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-hero border border-border-subtle p-6">
      {/* Subtle glow orbs */}
      <div className="absolute top-0 left-1/4 w-64 h-64 bg-accent-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-accent-secondary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 text-text-muted text-xs mb-1">
          <CalendarDays className="w-3.5 h-3.5" />
          <span className="capitalize">{dateStr}</span>
        </div>

        <h1 className="text-2xl font-semibold text-text-primary mb-1">
          {greeting}, <span className="text-gradient">Gilles</span>
        </h1>

        <p className="text-sm text-text-secondary max-w-xl">
          3 conversations actives, 2 taches critiques, 1 demo prevue demain.
          Votre equipe de 7 agents est operationnelle.
        </p>

        <div className="flex items-center gap-3 mt-4">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-white text-sm font-medium hover:bg-accent-primary/90 transition-all shadow-lg shadow-accent-primary/20">
            <Sparkles className="w-4 h-4" />
            Briefing du jour
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-border-subtle text-text-secondary text-sm font-medium hover:bg-white/[0.08] hover:text-text-primary transition-all">
            Voir les priorites
          </button>
        </div>
      </div>
    </div>
  );
}
