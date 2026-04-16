"use client";

import { X } from "lucide-react";

export function FormModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg mx-4 bg-surface-1 border border-border-subtle shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-bold font-headline uppercase tracking-wider text-text-primary">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="block micro-label text-text-muted mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputClass =
  "w-full bg-surface-2 border border-border-subtle text-sm py-2.5 px-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-primary/40 transition-all";

export const selectClass =
  "w-full bg-surface-2 border border-border-subtle text-sm py-2.5 px-3 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40 transition-all";

export const btnPrimary =
  "flex items-center justify-center gap-2 px-5 py-2.5 bg-accent-primary text-white text-xs font-bold uppercase tracking-widest hover:bg-accent-primary/80 transition-all disabled:opacity-50";

export const btnSecondary =
  "flex items-center justify-center gap-2 px-5 py-2.5 bg-surface-3 text-text-muted text-xs font-bold uppercase tracking-widest hover:bg-surface-4 transition-all";
