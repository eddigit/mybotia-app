"use client";

/**
 * useFormDraft — V1.1.H.1 P0-UX-2 anti-perte de saisie.
 *
 * Sauvegarde automatique de l'état d'un formulaire dans localStorage,
 * avec debounce 500 ms. Restauration au mount si un brouillon existe.
 * Nettoyage explicite via clearDraft() au succès du submit.
 *
 * Usage :
 *   const { hasDraft, clearDraft } = useFormDraft("draft:create-task", values, setValues);
 *
 * Convention clés :
 *   "draft:create-task"    → création tâche
 *   "draft:create-affaire" → création affaire
 *   "draft:create-quote"   → création devis
 *   "draft:create-client"  → création client
 */

import { useEffect, useRef, useState, useCallback } from "react";

export function useFormDraft<T>(
  formKey: string,
  values: T,
  setValues: (v: T) => void,
): {
  hasDraft: boolean;
  clearDraft: () => void;
  restoreDraft: () => void;
} {
  const [hasDraft, setHasDraft] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Avoid saving on the very first render (initial restore)
  const mountedRef = useRef(false);

  // At mount: restore if a draft exists
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(formKey);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        setValues(parsed);
        setHasDraft(true);
      }
    } catch {
      // Corrupt storage — ignore silently
    }
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey]);

  // On every values change: debounced save
  useEffect(() => {
    if (!mountedRef.current) return;
    if (typeof window === "undefined") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem(formKey, JSON.stringify(values));
        setHasDraft(true);
      } catch {
        // QuotaExceededError — ignore
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [formKey, values]);

  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(formKey);
    } catch {
      // ignore
    }
    setHasDraft(false);
  }, [formKey]);

  const restoreDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(formKey);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        setValues(parsed);
        setHasDraft(true);
      }
    } catch {
      // ignore
    }
  }, [formKey, setValues]);

  return { hasDraft, clearDraft, restoreDraft };
}
