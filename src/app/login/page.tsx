"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Footer } from "@/components/shared/Footer";

const LOGO_URL = "https://res.cloudinary.com/dniurvpzd/image/upload/q_auto/f_auto/v1772032713/Logo_Collaborateur_IA_coujhr.svg";

/**
 * Validation stricte du paramètre `next` pour éviter les open-redirects.
 * - URL relative interne : doit commencer par "/" et pas par "//"
 * - URL absolue : doit être HTTPS et pointer sur mybotia.com ou un sous-domaine
 * Tout le reste retombe sur "/".
 */
function safeNextUrl(next: string | null | undefined): string {
  if (!next) return "/";
  // Path interne (ex "/clients") — refuser "//evil.com"
  if (next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  // URL absolue — whitelist *.mybotia.com en HTTPS
  try {
    const url = new URL(next);
    if (url.protocol !== "https:") return "/";
    const host = url.hostname.toLowerCase();
    if (host === "mybotia.com" || host.endsWith(".mybotia.com")) {
      return url.toString();
    }
  } catch {
    // URL invalide
  }
  return "/";
}

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await login(email, password);
      if (result.ok) {
        const dest = safeNextUrl(nextParam);
        // Redirection externe (autre sous-domaine .mybotia.com) → window.location
        // pour forcer le browser à recharger avec le cookie .mybotia.com tout
        // neuf. Path interne → router.push pour navigation client-side classique.
        if (dest.startsWith("http")) {
          window.location.assign(dest);
          return;
        }
        router.push(dest);
        return;
      }
      setError(result.error || "Identifiants incorrects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau, réessaye");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 bg-gradient-hero px-4">
      <div className="w-full max-w-sm">
        {/* Logo + branding */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-5">
            <Image
              src={LOGO_URL}
              alt="MyBotIA"
              width={64}
              height={64}
              className="w-16 h-16 object-contain"
              unoptimized
            />
          </div>
          <h1 className="text-2xl mybotia-wordmark text-text-primary">
            MyBotIA
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Environnement de travail augmente
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="micro-label text-text-muted block mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              className="w-full px-4 py-3 bg-surface-2 border border-border-subtle text-text-primary text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-accent-primary/40 transition-colors"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label className="micro-label text-text-muted block mb-2">Mot de passe</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 pr-12 bg-surface-2 border border-border-subtle text-text-primary text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-accent-primary/40 transition-colors"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-text-muted hover:text-text-primary transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-accent-primary hover:bg-accent-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Connexion...
              </>
            ) : (
              "Se connecter"
            )}
          </button>
        </form>

        {/* Footer */}
        <Footer variant="login" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
