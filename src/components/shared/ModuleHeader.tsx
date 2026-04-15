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
      <div className="flex items-center gap-4">
        {Icon && (
          <div className="flex items-center justify-center w-10 h-10 bg-accent-primary/10 border border-accent-primary/20">
            <Icon className="w-5 h-5 text-accent-glow" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-extrabold tracking-tight uppercase text-text-primary font-headline flex items-center gap-2">
            <span className="w-4 h-0.5 bg-accent-primary" />
            {title}
          </h1>
          {subtitle && <p className="text-xs text-text-muted mt-1 font-medium">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
