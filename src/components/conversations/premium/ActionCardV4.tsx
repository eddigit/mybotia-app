"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Card d'action générique premium — V4.
 * Utilisée dans le panneau "Historique actions" du chat (devis créé, email envoyé, etc.)
 * ou pour des suggestions d'action proposées par Léa.
 */
export function ActionCardV4({
  icon,
  title,
  hint,
  status,
  href,
  onClick,
  trailing,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  status?: "success" | "warning" | "danger" | "info";
  href?: string;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  const statusColor =
    status === "success"
      ? "text-status-success"
      : status === "warning"
      ? "text-status-warning"
      : status === "danger"
      ? "text-status-danger"
      : status === "info"
      ? "text-status-info"
      : "text-text-muted";

  const inner = (
    <>
      <div className={`shrink-0 ${statusColor}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary truncate">
          {title}
        </div>
        {hint && (
          <div className="text-[11px] text-text-muted truncate">{hint}</div>
        )}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </>
  );

  const baseClass =
    "group flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-1 px-3 py-2.5 hover:border-border-default hover:bg-surface-2 transition-colors motion-safe:animate-fade-in";

  if (href) {
    return (
      <Link href={href} className={baseClass}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={`${baseClass} text-left w-full`}>
      {inner}
    </button>
  );
}
