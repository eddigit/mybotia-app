"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface AuthUser {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  tenant_id: string;
  tenant_slug: string;
  role: string;
  is_superadmin: boolean;
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
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loginData, setLoginData] = useState<LoginData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check session on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.authenticated) {
          setUser(data);
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
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
      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData && meData.authenticated) {
          setUser(meData);
        }
      }

      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erreur de connexion" };
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setLoginData(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loginData, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
