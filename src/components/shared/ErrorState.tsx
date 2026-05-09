"use client";

/**
 * ErrorState — composant partagé pour les fetch en échec.
 *
 * Doctrine produit : un fetch qui échoue ne doit JAMAIS donner un spinner
 * infini, ni une page blanche. Toujours un message clair + bouton "Réessayer"
 * quand un retry est possible.
 *
 * Usage minimal :
 *   <ErrorState message={error} onRetry={refetch} />
 */

import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "warning" | "danger";

export function ErrorState({
  title = "Impossible de charger les données",
  message,
  onRetry,
  retryLabel = "Réessayer",
  tone = "warning",
  className,
}: {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  tone?: Tone;
  className?: string;
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-400/30 bg-red-400/5 text-red-200"
      : "border-amber-400/30 bg-amber-400/5 text-amber-200";

  return (
    <div
      role="alert"
      className={cn(
        "card-sharp p-5 flex items-start gap-3 text-sm",
        toneClass,
        className,
      )}
    >
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-bold">{title}</p>
        {message ? (
          <p className="text-[12px] mt-1 opacity-80 break-words">{message}</p>
        ) : null}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-current/40 hover:bg-current/10 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            {retryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Variante "page entière" : centre vertical+horizontal.
 * Utile dans les layouts pleine page qui veulent garder un fallback identifiable.
 */
export function ErrorStatePage({
  title,
  message,
  onRetry,
  retryLabel,
  tone,
}: {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  tone?: Tone;
}) {
  return (
    <div className="p-8 min-h-[60vh] flex items-center justify-center">
      <div className="max-w-lg w-full">
        <ErrorState
          title={title}
          message={message}
          onRetry={onRetry}
          retryLabel={retryLabel}
          tone={tone}
        />
      </div>
    </div>
  );
}
