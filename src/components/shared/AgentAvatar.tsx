"use client";

import Image from "next/image";
import { getAgentAvatar } from "@/lib/agent-avatars";
import { cn } from "@/lib/utils";

export function AgentAvatar({
  agentId,
  size = 32,
  className,
}: {
  agentId: string;
  size?: number;
  className?: string;
}) {
  const config = getAgentAvatar(agentId);

  if (config.url) {
    return (
      <Image
        src={config.url}
        alt={agentId}
        width={size}
        height={size}
        className={cn("object-cover", className)}
        unoptimized
      />
    );
  }

  // Initials fallback
  const fontSize = size <= 24 ? "text-[9px]" : size <= 32 ? "text-[11px]" : "text-sm";

  return (
    <div
      className={cn(
        "flex items-center justify-center font-bold text-white",
        config.color,
        className
      )}
      style={{ width: size, height: size }}
    >
      <span className={fontSize}>{config.initials}</span>
    </div>
  );
}
