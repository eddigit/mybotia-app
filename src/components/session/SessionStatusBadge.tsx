"use client";

/**
 * SessionStatusBadge — V1.1.H.1 P0-UX-2
 *
 * Badge de statut session pour le header MyBotIA.
 * Aesthetic: instrument panel / mission control — minimal footprint when
 * healthy, escalating visual weight as danger grows.
 *
 * Feature: segmented arc that drains as time runs out (fuel gauge metaphor),
 * frosted-glass hover panel, typographic weight escalation.
 *
 * Props:
 *   status      — 'connected' | 'warning' | 'critical' | 'expired' | 'unknown'
 *   secondsLeft — seconds remaining (used for arc + tooltip text)
 *   onReconnect — called when user clicks "Reconnecter"
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ShieldCheck, ShieldAlert, ShieldX, RefreshCw, Clock } from "lucide-react";

export type SessionStatus = "connected" | "warning" | "critical" | "expired" | "unknown";

interface SessionStatusBadgeProps {
  status: SessionStatus;
  secondsLeft: number;
  onReconnect: () => void;
}

// ── Arc SVG ──────────────────────────────────────────────────────────────────
// 20×20 circle, stroke-dasharray trick: full arc = 100% = 56.5 (≈ 2π×9)
const ARC_LENGTH = 56.5;

function ArcProgress({ pct, color }: { pct: number; color: string }) {
  const filled = ARC_LENGTH * Math.max(0, Math.min(1, pct));
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      className="shrink-0 -rotate-90"
      aria-hidden
    >
      {/* Track */}
      <circle
        cx="10"
        cy="10"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-white/10"
      />
      {/* Fill */}
      <circle
        cx="10"
        cy="10"
        r="9"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={`${filled} ${ARC_LENGTH}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatMinutes(seconds: number): string {
  if (seconds <= 0) return "Expiré";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h`;
  if (m > 0) return `${m} min`;
  return `${s}s`;
}

function formatTooltip(status: SessionStatus, secondsLeft: number): string {
  if (status === "expired") return "Session expirée · Reconnexion requise";
  if (status === "unknown") return "Vérification en cours…";
  const m = Math.ceil(secondsLeft / 60);
  return `Connecté · expire dans ${m} min`;
}

// ── Per-status config ─────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  connected: {
    dot: "#10b981",        // status-success
    arc: "#10b981",
    label: "text-[#10b981]",
    capsule: "bg-[#10b981]/8 border-[#10b981]/20 hover:bg-[#10b981]/12",
    pulse: true,
    icon: ShieldCheck,
    iconClass: "text-[#10b981]",
    animate: "",
  },
  warning: {
    dot: "#f59e0b",        // status-warning
    arc: "#f59e0b",
    label: "text-[#f59e0b]",
    capsule: "bg-[#f59e0b]/10 border-[#f59e0b]/30 hover:bg-[#f59e0b]/15",
    pulse: false,
    icon: Clock,
    iconClass: "text-[#f59e0b]",
    animate: "",
  },
  critical: {
    dot: "#ef4444",        // status-danger
    arc: "#ef4444",
    label: "text-[#ef4444]",
    capsule: "bg-[#ef4444]/10 border-[#ef4444]/35 hover:bg-[#ef4444]/15",
    pulse: false,
    icon: ShieldAlert,
    iconClass: "text-[#ef4444]",
    animate: "animate-[subtle-flash_2s_ease-in-out_infinite]",
  },
  expired: {
    dot: "#ef4444",
    arc: "#ef4444",
    label: "text-[#ef4444] font-semibold",
    capsule: "bg-[#ef4444]/15 border-[#ef4444]/50 hover:bg-[#ef4444]/20",
    pulse: false,
    icon: ShieldX,
    iconClass: "text-[#ef4444]",
    animate: "",
  },
  unknown: {
    dot: "#5c6478",
    arc: "#5c6478",
    label: "text-[#5c6478]",
    capsule: "bg-white/4 border-white/10 hover:bg-white/6",
    pulse: false,
    icon: Clock,
    iconClass: "text-[#5c6478]",
    animate: "",
  },
} as const;

// Session TTL constants (must match auth-service)
const SESSION_TTL_SECONDS = 15 * 60; // 15 min

// ── Main component ────────────────────────────────────────────────────────────
export function SessionStatusBadge({
  status,
  secondsLeft,
  onReconnect,
}: SessionStatusBadgeProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;

  // Arc fill ratio: fraction of TTL remaining
  const arcPct = status === "expired" ? 0
    : status === "unknown" ? 1
    : Math.max(0, secondsLeft / SESSION_TTL_SECONDS);

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    if (panelOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [panelOpen]);

  const labelText = status === "unknown"
    ? "…"
    : status === "expired"
    ? "Expiré"
    : formatMinutes(secondsLeft);

  const tooltipText = formatTooltip(status, secondsLeft);

  return (
    <div className="relative" ref={panelRef}>
      {/* ── Capsule button ── */}
      <button
        type="button"
        onClick={() => setPanelOpen((v) => !v)}
        title={tooltipText}
        aria-label={tooltipText}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs",
          "transition-all duration-200 cursor-pointer select-none",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary/50",
          cfg.capsule,
          cfg.animate,
        )}
      >
        {/* Arc progress + dot overlay */}
        <span className="relative flex items-center justify-center w-5 h-5 shrink-0">
          <ArcProgress pct={arcPct} color={cfg.arc} />
          {/* Center dot */}
          <span
            className={cn(
              "absolute w-1.5 h-1.5 rounded-full",
              cfg.pulse && "animate-pulse",
            )}
            style={{ backgroundColor: cfg.dot }}
          />
        </span>

        {/* Label */}
        <span className={cn("leading-none tabular-nums", cfg.label)}>
          {labelText}
        </span>
      </button>

      {/* ── Dropdown panel ── */}
      {panelOpen && (
        <div
          className={cn(
            "absolute right-0 top-full mt-2 z-50",
            "w-64 rounded-xl border shadow-2xl shadow-black/40",
            "bg-[#131b2e]/95 backdrop-blur-xl border-white/8",
            "animate-[fade-in-down_0.15s_ease-out]",
          )}
        >
          {/* Panel header */}
          <div className="flex items-start gap-3 p-4 border-b border-white/6">
            <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", cfg.iconClass)} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary leading-tight">
                {status === "expired"
                  ? "Session expirée"
                  : status === "critical"
                  ? "Session critique"
                  : status === "warning"
                  ? "Session bientôt expirée"
                  : status === "unknown"
                  ? "Vérification…"
                  : "Session active"}
              </p>
              {status !== "expired" && status !== "unknown" && (
                <p className="text-xs text-text-muted mt-0.5">
                  Expire dans{" "}
                  <span className={cn("font-medium tabular-nums", cfg.label)}>
                    {formatMinutes(secondsLeft)}
                  </span>
                </p>
              )}
              {status === "expired" && (
                <p className="text-xs text-text-muted mt-0.5">
                  Votre session a expiré
                </p>
              )}
            </div>
          </div>

          {/* Arc visual in panel */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
              <span>Durée de vie</span>
              <span className={cn("tabular-nums font-medium", cfg.label)}>
                {status === "expired" ? "0 / 15 min"
                  : status === "unknown" ? "—"
                  : `${Math.ceil(secondsLeft / 60)} / 15 min`}
              </span>
            </div>
            {/* Linear progress bar */}
            <div className="h-1 rounded-full bg-white/8 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${arcPct * 100}%`,
                  backgroundColor: cfg.arc,
                }}
              />
            </div>
          </div>

          {/* Action footer */}
          {(status === "expired" || status === "critical" || status === "warning") && (
            <div className="px-4 pb-4">
              <button
                type="button"
                onClick={() => {
                  setPanelOpen(false);
                  onReconnect();
                }}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-3 py-2",
                  "rounded-lg text-sm font-medium transition-all duration-150",
                  "focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary/50",
                  status === "expired"
                    ? "bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#ef4444] border border-[#ef4444]/30"
                    : "bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-glow border border-accent-primary/20",
                )}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {status === "expired" ? "Reconnecter" : "Prolonger la session"}
              </button>
            </div>
          )}

          {status === "connected" && (
            <div className="px-4 pb-4">
              <p className="text-xs text-text-muted text-center">
                Renouvellement automatique actif
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Keyframes injected inline via style tag (Tailwind v4 custom) ── */}
      <style>{`
        @keyframes subtle-flash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.72; }
        }
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
