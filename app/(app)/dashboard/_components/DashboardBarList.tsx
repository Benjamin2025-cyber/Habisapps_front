import { cn } from "@/lib/cn";
import { toneColorVar, type Tone } from "./dashboard-tokens";

export type BarItem = {
  key: string;
  label: string;
  value: number;
  tone: Tone;
};

type Props = {
  items: BarItem[];
  /** Optional explicit max; defaults to the largest value (so bars are relative). */
  max?: number;
  className?: string;
  /** Format the numeric value (e.g. money). Defaults to the integer string. */
  formatValue?: (value: number) => string;
};

/**
 * Dependency-free horizontal bar list — one labelled, proportional bar per row.
 * Good for category distributions / funnels (loan status, KYC funnel, journal
 * status) where labels matter more than a donut's compactness.
 */
export function DashboardBarList({ items, max, className, formatValue }: Props) {
  const ceiling = Math.max(1, max ?? Math.max(0, ...items.map((i) => i.value)));
  const fmt = formatValue ?? ((v: number) => String(v));

  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {items.map((item) => {
        const pct = Math.round((Math.max(0, item.value) / ceiling) * 100);
        return (
          <li key={item.key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 text-foreground">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: toneColorVar(item.tone) }}
                />
                {item.label}
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {fmt(item.value)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: toneColorVar(item.tone) }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
