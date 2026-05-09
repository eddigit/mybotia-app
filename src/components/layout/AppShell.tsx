"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useAgents, useCockpitFeatures } from "@/hooks/use-api";
import { LeftSidebar } from "./LeftSidebar";
import { TopBar } from "./TopBar";
import { ContextRail } from "./ContextRail";
import { Footer } from "@/components/shared/Footer";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { MobileNavDrawer } from "./MobileNavDrawer";
import { VoiceConvProvider } from "@/contexts/voice-context";
import { getTenantBranding } from "@/lib/tenant/branding";
import { useSessionHeartbeat } from "@/hooks/use-session-heartbeat";
import { toast } from "@/components/shared/Toast";
import type { SessionStatus } from "@/components/session/SessionStatusBadge";

// Quick win 2 — propagation primaryColor tenant.
// On override `--color-accent-primary` et `--color-accent-glow` (tokens
// Tailwind v4 `@theme`) au niveau du wrapper de l'app : tous les utilitaires
// `bg-accent-primary`, `text-accent-glow`, `border-accent-primary/30`, etc.
// héritent de la couleur tenant sans toucher chaque composant.
// `--brand-primary` est exposé en alias pour les nouveaux composants qui
// veulent opt-in clairement (cf. brief V1.1.E).
function tintHex(hex: string, lightenPct: number): string {
  const m = hex.match(/^#?([a-fA-F0-9]{6})$/);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
  let b = n & 0xff;
  r = Math.round(r + (255 - r) * lightenPct);
  g = Math.round(g + (255 - g) * lightenPct);
  b = Math.round(b + (255 - b) * lightenPct);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  // Bloc 4C — Global Command Palette
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Mobile drawer (≤768px) — porte la même LeftSidebar derrière un burger menu.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { data: agents } = useAgents(false, !loading && !!user);
  const { data: cockpitFeatures } = useCockpitFeatures();

  // V1.1.H.1 P0-UX-2 — Session heartbeat + toast transitions
  const handleSessionStatusChange = useCallback(
    (status: SessionStatus, secondsLeft: number) => {
      if (status === "warning") {
        const m = Math.ceil(secondsLeft / 60);
        toast.info(`Session expire dans ${m} min · Sauvegardez votre travail.`);
      } else if (status === "critical") {
        const m = Math.ceil(secondsLeft / 60);
        if (m <= 1) {
          toast.error(`Session expire dans moins d'1 minute !`);
        } else {
          toast.error(`Session expire dans ${m} min · Reconnectez-vous.`);
        }
      } else if (status === "expired") {
        toast.error("Session expirée · Veuillez vous reconnecter.");
      }
    },
    [],
  );

  const handleReconnect = useCallback(() => {
    router.push("/login");
  }, [router]);

  const { status: sessionStatus, secondsLeft: sessionSecondsLeft } =
    useSessionHeartbeat(handleSessionStatusChange);

  // Quick win 2 — branding tenant courant → override des tokens accent au
  // niveau du wrapper de l'app. Fallback : MyBotIA (#0EA5E9) tant que le
  // cockpit n'est pas chargé.
  const brandStyle = useMemo<React.CSSProperties>(() => {
    const branding = getTenantBranding(cockpitFeatures?.tenant);
    const primary = branding.primaryColor;
    const glow = tintHex(primary, 0.18); // équivalent sky-400 vs sky-500
    return {
      ["--brand-primary" as string]: primary,
      ["--color-accent-primary" as string]: primary,
      ["--color-accent-glow" as string]: glow,
      ["--color-accent-secondary" as string]: primary,
      ["--color-accent-container" as string]: primary,
      ["--color-accent-light" as string]: tintHex(primary, 0.4),
      ["--color-border-accent" as string]: `${primary}40`,
    };
  }, [cockpitFeatures?.tenant]);

  // Bloc 4C — raccourci global Cmd+K (Mac) / Ctrl+K (Win/Linux)
  // Ne s'active pas sur /login (avant auth).
  useEffect(() => {
    if (pathname === "/login") return;
    function handler(e: KeyboardEvent) {
      // Cmd+K ou Ctrl+K toggle palette ; Esc handled in CommandPalette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pathname]);

  // Login page: render children directly (no shell)
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Auth loading: show spinner
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-0">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted micro-label">Chargement...</p>
        </div>
      </div>
    );
  }

  // Not authenticated: redirect to login
  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <VoiceConvProvider>
      <div
        className="flex h-screen w-screen overflow-hidden bg-surface-0"
        style={brandStyle}
      >
        {/* Left Sidebar — desktop only (≥md). Sur mobile, la sidebar est
            servie par MobileNavDrawer ci-dessous. */}
        <div className="hidden md:flex">
          <LeftSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Mobile drawer + sidebar embarquée */}
        <MobileNavDrawer
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        >
          <LeftSidebar
            collapsed={false}
            onToggle={() => undefined}
            variant="mobile"
            onNavigate={() => setMobileNavOpen(false)}
          />
        </MobileNavDrawer>

        {/* Main area */}
        <div className="flex flex-1 flex-col min-w-0">
          <TopBar
            railOpen={railOpen}
            onToggleRail={() => setRailOpen(!railOpen)}
            onOpenPalette={() => setPaletteOpen(true)}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            sessionStatus={sessionStatus}
            sessionSecondsLeft={sessionSecondsLeft}
            onReconnect={handleReconnect}
          />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
          <Footer />
        </div>

        {/* Context Rail (right) — masqué sur mobile pour libérer l'écran. */}
        {railOpen && (
          <div className="hidden md:flex">
            <ContextRail onClose={() => setRailOpen(false)} agents={agents} />
          </div>
        )}

        {/* Bloc 4C — Global Command Palette (Cmd/Ctrl+K) */}
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      </div>
    </VoiceConvProvider>
  );
}
