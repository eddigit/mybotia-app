"use client";

import Image from "next/image";

/**
 * Avatar utilisateur premium — V4.
 * Si avatarUrl fourni → image (futur, paramétrable). Sinon → initiales sur fond
 * coloré stable dérivé de l'email (hash simple). Cohérent avec AgentAvatar prod.
 */
export function UserAvatarV4({
  email,
  name,
  avatarUrl,
  size = 32,
  className,
}: {
  email?: string;
  name?: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name ?? email ?? "Vous"}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className ?? ""}`}
        unoptimized
      />
    );
  }

  const initials = getUserInitials(email, name);
  const color = colorFromString(email ?? name ?? "user");

  return (
    <div
      aria-label={name ?? email ?? "Vous"}
      style={{ width: size, height: size }}
      className={`rounded-full flex items-center justify-center text-white font-medium select-none ${color} ${
        className ?? ""
      }`}
    >
      <span style={{ fontSize: Math.max(10, Math.round(size * 0.4)) }}>
        {initials}
      </span>
    </div>
  );
}

export function getUserInitials(email?: string, name?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) {
    const local = email.split("@")[0];
    const seps = local.split(/[._-]/).filter(Boolean);
    if (seps.length >= 2) {
      return (seps[0][0] + seps[1][0]).toUpperCase();
    }
    return local.slice(0, 2).toUpperCase();
  }
  return "?";
}

const COLORS = [
  "bg-violet-600",
  "bg-sky-600",
  "bg-pink-600",
  "bg-amber-600",
  "bg-emerald-600",
  "bg-cyan-600",
  "bg-orange-600",
  "bg-blue-600",
  "bg-rose-600",
  "bg-teal-600",
];

function colorFromString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}
