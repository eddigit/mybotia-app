"use client";

/**
 * MobileNavDrawer — drawer responsive pour LeftSidebar (≤768px).
 *
 * Doctrine UX : sur mobile, la sidebar fixe rendrait l'app inutilisable
 * (250px verrouillés sur 375px). On la remplace par un drawer ouvert depuis
 * un burger menu en TopBar. Composant volontairement minimal — pas de
 * dépendance shadcn (non installé côté app).
 *
 * Préservation desktop : ce composant n'est rendu QU'EN dessous de `md`.
 * Le LeftSidebar desktop classique reste intact.
 */

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNavDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // ESC pour fermer + verrouille le scroll body quand ouvert
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity md:hidden",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      />
      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] bg-surface-0 shadow-2xl shadow-black/40 border-r border-border-subtle transition-transform duration-300 ease-out md:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-surface-3/80 hover:bg-surface-3 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Fermer le menu"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="h-full overflow-y-auto">{children}</div>
      </div>
    </>
  );
}
