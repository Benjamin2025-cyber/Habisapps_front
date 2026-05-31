"use client";

import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/cn";

type Tone = "accent" | "info" | "primary" | "success" | "danger";

export type DashboardAction = {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone?: Tone;
};

const toneStyles: Record<Tone, string> = {
  accent: "bg-accent/10 text-accent",
  info: "bg-info/10 text-info",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
};

/**
 * Reusable grid of quick-action tiles (icon + label) linking to app routes.
 * Used by the teller desk and any other rich dashboard layout.
 */
export function DashboardActionGrid({
  actions,
  columns = 2,
}: {
  actions: ReadonlyArray<DashboardAction>;
  columns?: 2 | 3;
}) {
  return (
    <div className={cn("grid gap-3", columns === 3 ? "grid-cols-3" : "grid-cols-2")}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.key}
            href={action.href}
            className="flex flex-col items-start gap-2 rounded-[var(--radius-field)] border border-border bg-background p-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-field)]",
                toneStyles[action.tone ?? "accent"],
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium text-foreground">
              {action.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
