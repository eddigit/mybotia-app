"use client";

import { cn } from "@/lib/utils";
import type { Agent } from "@/types";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<Size, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

const STATUS_DOT: Record<string, string> = {
  online: "bg-emerald-400",
  busy: "bg-amber-400",
  listening: "bg-cyan-400 animate-pulse",
  speaking: "bg-violet-400 animate-pulse",
  thinking: "bg-sky-400 animate-pulse",
  offline: "bg-zinc-500",
};

/**
 * AgentOrb — signature presence widget for every agent.
 * Shows the agent photo (or initials) inside a hue-tinted ring,
 * with an animated pulse ring when the agent is active and a
 * status dot at the bottom-right.
 */
export function AgentOrb({
  agent,
  size = "md",
  showPulse = true,
  showStatusDot = true,
  className,
}: {
  agent: Agent;
  size?: Size;
  showPulse?: boolean;
  showStatusDot?: boolean;
  className?: string;
}) {
  const px = SIZE_PX[size];
  const hue = agent.hue ?? 200;
  const isActive =
    agent.status === "online" ||
    agent.status === "listening" ||
    agent.status === "speaking" ||
    agent.status === "thinking";

  const initials = agent.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: px, height: px }}
    >
      {/* Outer signature ring — hue-tinted */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 180deg, hsl(${hue} 90% 60% / 0.9), hsl(${
            (hue + 60) % 360
          } 90% 65% / 0.4), hsl(${hue} 90% 60% / 0.9))`,
          padding: Math.max(2, Math.round(px / 24)),
        }}
      >
        {/* Photo / initials */}
        <div
          className="w-full h-full rounded-full overflow-hidden bg-surface-3 flex items-center justify-center"
          style={{ boxShadow: `inset 0 0 0 1px hsl(${hue} 80% 60% / 0.3)` }}
        >
          {agent.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={agent.photo}
              alt={agent.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              className="font-bold text-text-primary"
              style={{ fontSize: Math.max(9, Math.round(px / 2.8)) }}
            >
              {initials}
            </span>
          )}
        </div>
      </div>

      {/* Pulse ring — only when active */}
      {showPulse && isActive && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none animate-pulse-ring"
          style={{ border: `1px solid hsl(${hue} 90% 60% / 0.5)` }}
        />
      )}

      {/* Status dot */}
      {showStatusDot && (
        <div
          className={cn(
            "absolute rounded-full ring-2 ring-surface-0",
            STATUS_DOT[agent.status] ?? STATUS_DOT.offline
          )}
          style={{
            width: Math.max(6, Math.round(px / 5)),
            height: Math.max(6, Math.round(px / 5)),
            bottom: 0,
            right: 0,
          }}
        />
      )}
    </div>
  );
}

/**
 * Thin animated waveform rendered when an agent is speaking.
 */
export function AgentWaveform({
  active,
  hue = 200,
  bars = 14,
}: {
  active: boolean;
  hue?: number;
  bars?: number;
}) {
  return (
    <div className="flex items-center gap-[3px] h-4">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "w-[2px] rounded-full transition-all",
            active ? "animate-pulse" : ""
          )}
          style={{
            height: active ? `${30 + Math.abs(Math.sin(i * 1.3)) * 70}%` : "20%",
            background: `hsl(${hue} 90% 60% / ${active ? 0.9 : 0.3})`,
            animationDelay: `${i * 70}ms`,
            animationDuration: "900ms",
          }}
        />
      ))}
    </div>
  );
}
