import { cn } from "@/lib/cn";
import type { ComponentType, ReactNode, SVGProps } from "react";

type Tone = "primary" | "accent" | "success" | "warning" | "danger" | "info";

type Props = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone?: Tone;
  label: string;
  value: ReactNode;
  /** Small caption rendered below the value. */
  hint?: ReactNode;
  /** Right-aligned slot (e.g. mini badge, ratio chip). */
  trailing?: ReactNode;
  className?: string;
};

const toneStyles: Record<Tone, { ring: string; bg: string; text: string }> = {
  primary: { ring: "ring-primary/15", bg: "bg-primary/10", text: "text-primary" },
  accent: { ring: "ring-accent/15", bg: "bg-accent/10", text: "text-accent" },
  success: { ring: "ring-success/15", bg: "bg-success/10", text: "text-success" },
  warning: { ring: "ring-warning/15", bg: "bg-warning/10", text: "text-warning" },
  danger: { ring: "ring-danger/15", bg: "bg-danger/10", text: "text-danger" },
  info: { ring: "ring-info/15", bg: "bg-info/10", text: "text-info" },
};

export function DashboardKpiCard({
  icon: Icon,
  tone = "primary",
  label,
  value,
  hint,
  trailing,
  className,
}: Props) {
  const styles = toneStyles[tone];
  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-background p-5",
        "shadow-[0_8px_30px_-20px_rgba(20,6,47,0.12)]",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-field)] ring-4",
            styles.bg,
            styles.text,
            styles.ring,
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        {trailing ? <div className="flex shrink-0 items-center">{trailing}</div> : null}
      </header>

      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </article>
  );
}
