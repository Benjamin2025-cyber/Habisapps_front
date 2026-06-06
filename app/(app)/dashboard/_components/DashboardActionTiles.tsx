import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { WorkflowIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { DashboardCard } from "./DashboardCard";
import type { Tone } from "./dashboard-tokens";

export type ActionTile = {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: Tone;
};

const TILE_TONE: Record<Tone, { wrap: string; icon: string }> = {
  success: { wrap: "border-success/20 bg-success/5 hover:bg-success/10", icon: "bg-success/15 text-success" },
  danger: { wrap: "border-danger/20 bg-danger/5 hover:bg-danger/10", icon: "bg-danger/15 text-danger" },
  accent: { wrap: "border-accent/20 bg-accent/5 hover:bg-accent/10", icon: "bg-accent/15 text-accent" },
  info: { wrap: "border-info/20 bg-info/5 hover:bg-info/10", icon: "bg-info/15 text-info" },
  primary: { wrap: "border-primary/20 bg-primary/5 hover:bg-primary/10", icon: "bg-primary/15 text-primary" },
  warning: { wrap: "border-warning/20 bg-warning/5 hover:bg-warning/10", icon: "bg-warning/15 text-warning" },
  neutral: { wrap: "border-border bg-muted/40 hover:bg-muted", icon: "bg-muted text-muted-foreground" },
};

/**
 * "Actions rapides" card — a responsive grid of tinted navigation tiles. Pass
 * only the actions a role's permissions unlock (gating is the caller's job).
 */
export function DashboardActionTiles({
  title,
  actions,
  columns = 2,
}: {
  title: string;
  actions: ActionTile[];
  columns?: 2 | 3;
}) {
  if (actions.length === 0) return null;
  return (
    <DashboardCard title={title} icon={WorkflowIcon} tone="accent">
      <div
        className={cn(
          "grid gap-3",
          columns === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2",
        )}
      >
        {actions.map((action) => {
          const Icon = action.icon;
          const tone = TILE_TONE[action.tone];
          return (
            <Link
              key={action.key}
              href={action.href}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-field)] border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tone.wrap,
              )}
            >
              <span
                className={cn(
                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-field)]",
                  tone.icon,
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium text-foreground">{action.label}</span>
            </Link>
          );
        })}
      </div>
    </DashboardCard>
  );
}
