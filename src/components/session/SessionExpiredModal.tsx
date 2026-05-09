"use client";

/**
 * SessionExpiredModal — V1.1.H.1 P0-UX-2 anti-perte de saisie.
 *
 * Écoute l'event window "mybotia:session-expired" dispatché par apiFetch
 * quand un 401 non récupérable est reçu (refresh échoué).
 *
 * Affiche une modal blocante informant l'utilisateur que son travail est
 * conservé en localStorage et lui proposant de se reconnecter.
 *
 * Mount : app/layout.tsx root (en dehors de AppShell — Builder 2 est propriétaire
 * d'AppShell).
 */

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";

export function SessionExpiredModal() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  const handleSessionExpired = useCallback(() => {
    setVisible(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("mybotia:session-expired", handleSessionExpired);
    return () =>
      window.removeEventListener(
        "mybotia:session-expired",
        handleSessionExpired,
      );
  }, [handleSessionExpired]);

  if (!visible) return null;

  const next = encodeURIComponent(pathname ?? "/");
  const loginUrl = `/login?next=${next}`;

  return (
    /* Overlay blocant — z-[9999] pour passer au-dessus de toute autre modal */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
    >
      <div className="relative w-full max-w-sm mx-4 bg-surface-1 border border-border-subtle shadow-2xl p-8 flex flex-col items-center gap-5">
        {/* Accent bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent-primary via-accent-glow to-transparent" />

        {/* Icon */}
        <div className="w-12 h-12 rounded-full border border-amber-400/40 bg-amber-400/10 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-amber-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>

        <div className="text-center space-y-2">
          <h2
            id="session-expired-title"
            className="text-base font-headline font-bold text-text-primary tracking-tight"
          >
            Session expirée
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Ton travail est conservé.
            <br />
            Reconnecte-toi pour continuer.
          </p>
        </div>

        <a
          href={loginUrl}
          className="w-full text-center px-5 py-2.5 text-sm font-bold uppercase tracking-tight bg-accent-primary text-white hover:bg-accent-primary/90 transition-colors"
        >
          Reconnexion
        </a>
      </div>
    </div>
  );
}
