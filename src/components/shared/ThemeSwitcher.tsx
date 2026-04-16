"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const options = [
  { value: "light", icon: Sun, label: "Clair" },
  { value: "dark", icon: Moon, label: "Sombre" },
  { value: "system", icon: Monitor, label: "Systeme" },
] as const;

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-[92px] h-8" />;
  }

  return (
    <div className="flex items-center bg-surface-2 rounded-lg p-0.5 border border-border-subtle">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            "flex items-center justify-center w-[30px] h-7 rounded-md transition-all",
            theme === value
              ? "bg-accent-primary/15 text-accent-glow"
              : "text-text-muted hover:text-text-secondary"
          )}
          title={label}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}
