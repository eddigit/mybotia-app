"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";

const LOGO_URL = "https://res.cloudinary.com/dniurvpzd/image/upload/q_auto/f_auto/v1772032713/Logo_Collaborateur_IA_coujhr.svg";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const result = await login(email, password);

    if (result.ok) {
      router.push("/");
    } else {
      setError(result.error || "Identifiants incorrects");
    }

    setSubmitting(false);
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
          <h1 className="text-2xl font-headline font-extrabold text-text-primary tracking-tight">
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
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 bg-surface-2 border border-border-subtle text-text-primary text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-accent-primary/40 transition-colors"
              placeholder="••••••••"
            />
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
        <p className="text-center text-text-muted/40 text-[10px] mt-10 tracking-wide">
          MyBotIA &mdash; Coach Digital Paris
        </p>
      </div>
    </div>
  );
}
