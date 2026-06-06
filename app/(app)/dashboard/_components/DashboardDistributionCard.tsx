import type { ComponentType, SVGProps } from "react";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { DashboardCard } from "./DashboardCard";
import { DashboardDonut, type DonutSegment } from "./DashboardDonut";
import { toneColorVar } from "./dashboard-tokens";

type Props = {
  title: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  segments: DonutSegment[];
  loading?: boolean;
  /** Label under the donut's center total. */
  centerLabel?: string;
  action?: { href: string; label: string };
};

/**
 * A donut + legend card driven by per-status counts. Segments with a zero value
 * still appear in the legend (so the user sees the full set of buckets) but
 * contribute no arc.
 */
export function DashboardDistributionCard({
  title,
  icon,
  segments,
  loading,
  centerLabel,
  action,
}: Props) {
  const t = useTranslations();
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  return (
    <DashboardCard title={title} icon={icon} tone="accent" action={action}>
      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </p>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
          <DashboardDonut
            segments={segments}
            centerLabel={centerLabel}
            className="shrink-0"
          />
          <ul className="flex w-full flex-col gap-2">
            {segments.map((seg) => {
              const pct = total > 0 ? Math.round((Math.max(0, seg.value) / total) * 100) : 0;
              return (
                <li
                  key={seg.key}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="flex items-center gap-2 text-foreground">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: toneColorVar(seg.tone) }}
                    />
                    {seg.label}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums text-foreground">
                      {seg.value}
                    </span>
                    <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                      {pct}%
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </DashboardCard>
  );
}
