"use client";

/**
 * useSessionHeartbeat — V1.1.H.1 P0-UX-2
 *
 * Polls /api/auth/me every 60s to track session freshness.
 * Uses `exp` (Unix timestamp in seconds) from the JWT payload
 * to compute remaining TTL client-side.
 *
 * Behaviour:
 *  - Pauses polling while `document.hidden` (tab inactive)
 *  - Resumes + immediately re-fetches on window `focus`
 *  - Emits status transitions for toast notifications
 *
 * Returns:
 *  { status, secondsLeft, expiresAt, refresh }
 *
 * Status thresholds:
 *  connected  > 5 min remaining
 *  warning    5–3 min remaining
 *  critical   3–1 min remaining  (toast at 3 min AND at 1 min)
 *  expired    ≤ 0 s OR 401 from /me
 *  unknown    not yet resolved (initial load)
 */

import { useEffect, useRef, useCallback, useState } from "react";
import type { SessionStatus } from "@/components/session/SessionStatusBadge";

const POLL_INTERVAL_MS = 60_000; // 60 seconds

export interface SessionHeartbeatResult {
  status: SessionStatus;
  secondsLeft: number;
  expiresAt: number | null; // Unix timestamp in seconds, or null if unknown
  refresh: () => void;      // Force immediate re-fetch
}

function computeStatus(secondsLeft: number): SessionStatus {
  if (secondsLeft <= 0) return "expired";
  if (secondsLeft <= 3 * 60) return "critical";
  if (secondsLeft <= 5 * 60) return "warning";
  return "connected";
}

export function useSessionHeartbeat(
  onStatusChange?: (status: SessionStatus, secondsLeft: number) => void,
): SessionHeartbeatResult {
  const [status, setStatus] = useState<SessionStatus>("unknown");
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  // Track previous status to detect transitions for toasts
  const prevStatusRef = useRef<SessionStatus>("unknown");
  // Track which critical thresholds have triggered toasts this session window
  const criticalToastedAt = useRef<Set<string>>(new Set());

  const updateFromExp = useCallback(
    (exp: number | null) => {
      if (!exp) {
        setStatus("expired");
        setSecondsLeft(0);
        setExpiresAt(null);
        return;
      }
      const nowS = Math.floor(Date.now() / 1000);
      const left = exp - nowS;
      const nextStatus = computeStatus(left);

      setExpiresAt(exp);
      setSecondsLeft(Math.max(0, left));
      setStatus(nextStatus);

      // Fire transition callback
      const prev = prevStatusRef.current;
      if (prev !== nextStatus) {
        prevStatusRef.current = nextStatus;
        onStatusChange?.(nextStatus, Math.max(0, left));
      }

      // Critical threshold sub-toasts: fire at ≤3 min and ≤1 min
      if (nextStatus === "critical") {
        const minuteKey = left <= 60 ? "1min" : "3min";
        if (!criticalToastedAt.current.has(minuteKey)) {
          criticalToastedAt.current.add(minuteKey);
          onStatusChange?.(nextStatus, Math.max(0, left));
        }
      }
    },
    [onStatusChange],
  );

  const fetchSession = useCallback(async () => {
    // Skip fetch if tab is hidden (resume on focus)
    if (typeof document !== "undefined" && document.hidden) return;

    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });

      if (res.status === 401) {
        // Expired or invalid token — confirm expired state
        setStatus("expired");
        setSecondsLeft(0);
        setExpiresAt(null);
        const prev = prevStatusRef.current;
        if (prev !== "expired") {
          prevStatusRef.current = "expired";
          onStatusChange?.("expired", 0);
        }
        return;
      }

      if (!res.ok) {
        // Network error or server issue — don't flip to expired, keep last state
        return;
      }

      const data = await res.json();

      if (!data.authenticated) {
        setStatus("expired");
        setSecondsLeft(0);
        setExpiresAt(null);
        const prev = prevStatusRef.current;
        if (prev !== "expired") {
          prevStatusRef.current = "expired";
          onStatusChange?.("expired", 0);
        }
        return;
      }

      // Reset critical toast tracker on new session window
      if (data.exp && expiresAt && data.exp !== expiresAt) {
        criticalToastedAt.current.clear();
      }

      updateFromExp(data.exp ?? null);
    } catch {
      // Swallow network errors silently — don't falsely expire session
    }
  }, [updateFromExp, onStatusChange, expiresAt]);

  // Tick counter drives the polling interval
  const [tick, setTick] = useState(0);

  // Initial fetch on mount
  useEffect(() => {
    fetchSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling loop — 60s interval, skips while tab hidden
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Fetch whenever tick increments
  useEffect(() => {
    if (tick === 0) return; // already fetched on mount
    fetchSession();
  }, [tick, fetchSession]);

  // Resume + immediate re-fetch on window focus
  useEffect(() => {
    function onFocus() {
      fetchSession();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchSession]);

  // Local countdown — updates secondsLeft every second between polls
  // so the display doesn't freeze at a stale value
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => {
      const left = expiresAt - Math.floor(Date.now() / 1000);
      if (left <= 0) {
        setSecondsLeft(0);
        setStatus("expired");
        clearInterval(id);
      } else {
        setSecondsLeft(left);
        // Also keep status in sync with real-time countdown
        const nextStatus = computeStatus(left);
        setStatus((prev) => {
          if (prev !== nextStatus) {
            return nextStatus;
          }
          return prev;
        });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const refresh = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  return { status, secondsLeft, expiresAt, refresh };
}
