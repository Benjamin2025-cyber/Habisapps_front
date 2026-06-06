import type { ComponentType, ReactNode, SVGProps } from "react";
import { cn } from "@/lib/cn";
import { TONE_CHIP, type Tone } from "./dashboard-tokens";

type Props = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClassName?: string;
  tone: Tone;
  label: string;
  value: ReactNode;
  footer?: ReactNode;
  loading?: boolean;
};

/**
 * KPI tile matching the teller-redesign look (tinted icon chip + label on top,
 * big tabular value, optional footer). Shared across every role dashboard's KPI
 * strip so the visual language stays consistent.
 */
export function DashboardStatTile({
  icon: Icon,
  iconClassName,
  tone,
  label,
  value,
  footer,
  loading,
}: Props) {
  return (
    <div className="flex flex-col rounded-[var(--radius-card)] border border-border bg-background p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-field)]",
            TONE_CHIP[tone],
          )}
        >
          <Icon className={cn("h-4 w-4", iconClassName)} />
        </span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-foreground">
        {loading ? "—" : value}
      </p>
      {footer ? <div className="mt-2">{footer}</div> : null}
    </div>
  );
}
