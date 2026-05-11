"use client";

// Vault client UI — lecture seule. PIN modal → liste des KEY par section avec
// preview masqué + reveal individuel + bouton lock.
//
// Toutes les communications passent par /api/admin/vault/*. La valeur n'est
// jamais en mémoire avant un reveal explicite.

import { useEffect, useState, useCallback } from "react";
import { Lock, LockOpen, Eye, EyeOff, Copy, Check, RefreshCw, ShieldAlert } from "lucide-react";

type VaultEntryListed = {
  key: string;
  comment: string | null;
  length: number;
  preview: string;
};

type VaultSectionListed = {
  name: string;
  entries: VaultEntryListed[];
};

type ListResponse = {
  sections: VaultSectionListed[];
  sessionExpiresAt: string;
};

const MASK_RE_SHORT = /^.{0,8}$/;

export function VaultClient() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Map<string, string>>(new Map());
  const [revealing, setRevealing] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState<number>(0);

  // Tick chaque seconde pour le compteur TTL + auto-lock côté UI.
  useEffect(() => {
    if (!unlocked || !data) return;
    const exp = new Date(data.sessionExpiresAt).getTime();
    const tick = () => {
      const s = Math.max(0, Math.floor((exp - Date.now()) / 1000));
      setRemainingSec(s);
      if (s === 0) handleLock();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, data?.sessionExpiresAt]);

  const loadList = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/vault", { cache: "no-store" });
      if (res.status === 401) {
        setUnlocked(false);
        setData(null);
        setRevealed(new Map());
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ListResponse;
      setData(json);
      setUnlocked(true);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }, []);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setPinError(null);
    setUnlocking(true);
    try {
      const res = await fetch("/api/admin/vault/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 429) {
          const mins = Math.ceil((body?.retryAfterMs ?? 0) / 60_000);
          setPinError(`Trop d'essais — réessaye dans ${mins} min.`);
        } else if (res.status === 401) {
          setPinError("PIN incorrect.");
        } else if (res.status === 403) {
          setPinError("Accès interdit (vault réservé à l'owner).");
        } else {
          setPinError(body?.error ?? `Erreur ${res.status}`);
        }
        return;
      }
      setPin("");
      await loadList();
    } finally {
      setUnlocking(false);
    }
  }

  async function handleReveal(key: string) {
    if (revealed.has(key)) {
      setRevealed((m) => {
        const n = new Map(m);
        n.delete(key);
        return n;
      });
      return;
    }
    setRevealing(key);
    try {
      const res = await fetch(`/api/admin/vault/${encodeURIComponent(key)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setUnlocked(false);
          setData(null);
          setRevealed(new Map());
          return;
        }
        alert(body?.error ?? `Erreur ${res.status}`);
        return;
      }
      const body = (await res.json()) as { key: string; value: string };
      setRevealed((m) => new Map(m).set(body.key, body.value));
    } finally {
      setRevealing(null);
    }
  }

  async function handleCopy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      alert("Copie impossible");
    }
  }

  async function handleLock() {
    setUnlocked(false);
    setData(null);
    setRevealed(new Map());
    setRemainingSec(0);
    try {
      await fetch("/api/admin/vault/lock", { method: "POST" });
    } catch {
      // best effort
    }
  }

  if (!unlocked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-sm rounded-xl border border-border bg-surface-2 p-6 space-y-4 shadow-2xl"
        >
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-accent-primary" />
            <h1 className="text-lg font-semibold">Vault — déverrouillage</h1>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Saisis ton PIN à 6 chiffres pour accéder au coffre. La session dure
            10 minutes puis se referme automatiquement.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="vault-pin" className="text-xs font-medium">
              PIN
            </label>
            <input
              id="vault-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]{6}"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full rounded-md bg-surface-3 border border-border px-3 py-2 text-center text-lg tracking-[0.4em] font-mono focus:outline-none focus:ring-1 focus:ring-accent-primary"
              placeholder="••••••"
              autoFocus
            />
          </div>

          {pinError && (
            <div className="flex items-start gap-2 rounded-md border border-rose-400/30 bg-rose-400/10 p-2 text-xs text-rose-300">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{pinError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={pin.length !== 6 || unlocking}
            className="w-full rounded-md bg-accent-primary px-3 py-2 text-sm font-medium text-white hover:bg-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {unlocking ? "Vérification…" : "Déverrouiller"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <LockOpen className="h-5 w-5 text-emerald-400" />
            Vault
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Lecture seule — pour modifier un secret, contacter Damien en CLI.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted font-mono">
            session : {Math.floor(remainingSec / 60)}:
            {String(remainingSec % 60).padStart(2, "0")}
          </span>
          <button
            onClick={loadList}
            className="rounded-md border border-border bg-surface-2 hover:bg-surface-3 p-1.5 transition-colors"
            title="Rafraîchir"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleLock}
            className="rounded-md border border-border bg-surface-2 hover:bg-rose-500/20 hover:text-rose-300 px-2 py-1 text-xs flex items-center gap-1 transition-colors"
          >
            <Lock className="h-3 w-3" />
            Verrouiller
          </button>
        </div>
      </header>

      {loadError && (
        <div className="rounded-md border border-rose-400/30 bg-rose-400/10 p-3 text-xs text-rose-300">
          {loadError}
        </div>
      )}

      {data && data.sections.map((section) => (
        <section key={section.name} className="rounded-lg border border-border bg-surface-2 overflow-hidden">
          <h2 className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted bg-surface-3 border-b border-border">
            {section.name}
          </h2>
          <div className="divide-y divide-border">
            {section.entries.map((entry) => {
              const isRevealed = revealed.has(entry.key);
              const value = revealed.get(entry.key) ?? entry.preview;
              const isShort = MASK_RE_SHORT.test(entry.preview);
              return (
                <div key={entry.key} className="px-4 py-3 hover:bg-surface-3/50 transition-colors">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-sm font-medium text-text-primary">
                        {entry.key}
                      </div>
                      {entry.comment && (
                        <div className="text-[11px] text-text-muted mt-0.5 line-clamp-2">
                          {entry.comment}
                        </div>
                      )}
                      <div className={`font-mono text-xs mt-1.5 break-all ${isRevealed ? "text-accent-primary" : "text-text-muted"}`}>
                        {value}
                        {!isRevealed && !isShort && (
                          <span className="ml-2 text-[10px] text-text-muted/60">
                            ({entry.length} car.)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isRevealed && (
                        <button
                          onClick={() => handleCopy(entry.key, revealed.get(entry.key)!)}
                          className="rounded border border-border bg-surface-3 hover:bg-surface-2 p-1.5 transition-colors"
                          title="Copier"
                        >
                          {copied === entry.key ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleReveal(entry.key)}
                        disabled={revealing === entry.key}
                        className="rounded border border-border bg-surface-3 hover:bg-surface-2 p-1.5 transition-colors disabled:opacity-50"
                        title={isRevealed ? "Masquer" : "Révéler"}
                      >
                        {isRevealed ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
