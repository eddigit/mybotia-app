import type { LucideIcon } from "lucide-react";

export function ModuleHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent-primary/10 border border-accent-primary/20">
            <Icon className="w-[18px] h-[18px] text-accent-glow" />
          </div>
        )}
        <div>
          <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
          {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
