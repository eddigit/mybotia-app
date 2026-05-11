"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import { apiFetchOptional } from "@/lib/api-client";

interface AuthUser {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  tenant_id: string;
  tenant_slug: string;
  role: string;
  is_superadmin: boolean;
  // V1.2.D-hotfix : avatar_url n'est PAS dans le JWT (signé par auth-service,
  // doctrine : ne pas toucher auth-service). Hydraté via /api/me/profile au
  // mount du provider + après login + via refreshProfile() après /settings.
  avatar_url: string | null;
}

interface LoginData {
  user: { id: string; email: string; first_name: string; last_name: string; is_superadmin: boolean };
  tenant: { id: string; slug: string; display_name: string; profile: string; role: string };
  tenants: { id: string; slug: string; display_name: string; role: string }[];
}

interface AuthContextType {
  user: AuthUser | null;
  loginData: LoginData | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  /**
   * Recharge le profil (avatar_url, etc.) depuis /api/me/profile.
   * À appeler après update profil (settings) pour propager dans sidebar/chat.
   */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loginData, setLoginData] = useState<LoginData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // V1.2.D-hotfix : extract avatar_url depuis /api/me/profile (pas dans JWT).
  // Erreurs silencieuses — pas bloquant pour l'auth si la DB est down.
  const fetchAvatarUrl = useCallback(async (): Promise<string | null> => {
    try {
      const res = await apiFetchOptional("/api/me/profile");
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data?.avatar_url === "string" ? data.avatar_url : null;
    } catch {
      return null;
    }
  }, []);

  // Check session on mount.
  // CL3 : apiFetchOptional tente un refresh silencieux si /me renvoie 401
  // (token expiré). Pas de redirect login forcé — l'utilisateur peut être
  // légitimement non connecté.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetchOptional("/api/auth/me");
        const data = await res.json();
        if (data && data.authenticated) {
          // Hydrate avatar_url depuis /api/me/profile en parallèle.
          const avatar_url = await fetchAvatarUrl();
          if (!cancelled) setUser({ ...data, avatar_url });
        } else if (!cancelled) {
          setUser(null);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchAvatarUrl]);

  const refreshProfile = useCallback(async () => {
    const avatar_url = await fetchAvatarUrl();
    setUser((prev) => (prev ? { ...prev, avatar_url } : prev));
  }, [fetchAvatarUrl]);

  const login = useCallback(async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { ok: false, error: data.error || "Identifiants incorrects" };
      }

      setLoginData(data);

      // Fetch /me to get decoded claims
      const meRes = await apiFetchOptional("/api/auth/me");
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData && meData.authenticated) {
          // V1.2.D-hotfix : hydrate avatar_url (pas dans le JWT)
          const avatar_url = await fetchAvatarUrl();
          setUser({ ...meData, avatar_url });
        }
      }

      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erreur de connexion" };
    }
  }, [fetchAvatarUrl]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setLoginData(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loginData, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
