"use client";

import Image from "next/image";
import { getHumanAvatar } from "@/lib/agent-avatars";
import { cn } from "@/lib/utils";

export function HumanAvatar({
  email,
  name,
  fallbackLabel,
  size = 28,
  className,
  title,
}: {
  email?: string | null;
  name?: string | null;
  fallbackLabel?: string | null;
  size?: number;
  className?: string;
  title?: string;
}) {
  const config = getHumanAvatar({ email, name, fallbackLabel });
  const label = title || config.label;
  const fontSize = size <= 22 ? "text-[8px]" : size <= 30 ? "text-[10px]" : "text-xs";

  if (config.url) {
    return (
      <Image
        src={config.url}
        alt={label}
        title={label}
        width={size}
        height={size}
        className={cn("rounded-full object-cover shrink-0", className)}
        unoptimized
      />
    );
  }

  return (
    <div
      title={label}
      aria-label={label}
      className={cn(
        "flex items-center justify-center rounded-full shrink-0 font-bold text-white",
        config.color,
        className
      )}
      style={{ width: size, height: size }}
    >
      <span className={fontSize}>{config.initials}</span>
    </div>
  );
}
