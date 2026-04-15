import { Zap } from "lucide-react";

export function CommandCenterHero() {
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Bonjour" : now.getHours() < 18 ? "Bon apres-midi" : "Bonsoir";

  return (
    <section className="mb-8">
      {/* Greeting */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-text-primary font-headline mb-2">
          {greeting}, <span className="text-gradient">Gilles</span>.
        </h1>
        <p className="text-text-secondary font-medium">
          MyBotIA est synchronise sur 7 agents actifs et 5 projets en cours.
        </p>
      </div>

      {/* Omnibar — Sovereign style */}
      <div className="relative group max-w-4xl mx-auto">
        {/* Glow backdrop */}
        <div className="absolute -inset-1 bg-gradient-to-r from-accent-primary/15 to-transparent blur-xl opacity-40 group-focus-within:opacity-80 transition duration-500 pointer-events-none" />

        <div className="relative flex items-center bg-surface-2 border-b-2 border-accent-primary/25 focus-within:border-accent-primary/60 transition-all">
          <div className="px-6">
            <Zap className="w-6 h-6 text-accent-glow" />
          </div>
          <input
            type="text"
            placeholder="Demander a l'IA d'analyser, orchestrer ou executer une tache..."
            className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-lg font-body py-5 text-text-primary placeholder:text-text-muted"
          />
          <div className="pr-6 flex items-center gap-1.5">
            <kbd className="px-2 py-1 text-[9px] font-bold bg-surface-3 rounded border border-white/[0.06] text-text-muted font-mono">CMD</kbd>
            <kbd className="px-2 py-1 text-[9px] font-bold bg-surface-3 rounded border border-white/[0.06] text-text-muted font-mono">J</kbd>
          </div>
        </div>
      </div>
    </section>
  );
}
