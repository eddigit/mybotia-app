"use client";

// V1.1.D Phase 2 — Toast minimal sans dépendance externe (sonner indispo
// dans le bundle). Utilise un état module-scoped + un singleton root injecté
// via <ToastHost />. Auto-dismiss après 4s, fermable au clic.

import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";
type ToastEntry = { id: number; variant: ToastVariant; message: string };

let nextId = 1;
let toasts: ToastEntry[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return toasts;
}

function getServerSnapshot() {
  return toasts;
}

export function pushToast(variant: ToastVariant, message: string) {
  const id = nextId++;
  toasts = [...toasts, { id, variant, message }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 4000);
}

export const toast = {
  success(message: string) {
    pushToast("success", message);
  },
  error(message: string) {
    pushToast("error", message);
  },
  info(message: string) {
    pushToast("info", message);
  },
};

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function ToastHost() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!mounted) return null;

  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
      {list.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-start gap-2 px-4 py-3 border shadow-lg max-w-sm text-sm",
            t.variant === "success" &&
              "bg-emerald-500/10 border-emerald-500/40 text-emerald-200",
            t.variant === "error" &&
              "bg-rose-500/10 border-rose-500/40 text-rose-200",
            t.variant === "info" &&
              "bg-accent-primary/10 border-accent-primary/40 text-accent-glow",
          )}
        >
          {t.variant === "success" && (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          {t.variant === "error" && (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="text-text-muted hover:text-text-primary transition-colors shrink-0"
            aria-label="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
