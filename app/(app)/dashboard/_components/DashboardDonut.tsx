import { cn } from "@/lib/cn";
import { toneColorVar, type Tone } from "./dashboard-tokens";

export type DonutSegment = {
  key: string;
  label: string;
  value: number;
  tone: Tone;
};

type Props = {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  /** Big number rendered in the middle (defaults to the total). */
  centerValue?: string;
  centerLabel?: string;
  className?: string;
};

/**
 * Dependency-free SVG donut. Segments are drawn as arcs via `stroke-dasharray`
 * on concentric circles; an empty/zero dataset shows just the muted track ring.
 * Pair with a legend (see `DashboardDistributionCard`).
 */
export function DashboardDonut({
  segments,
  size = 168,
  thickness = 20,
  centerValue,
  centerLabel,
  className,
}: Props) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let offset = 0;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
        <g transform={`rotate(-90 ${center} ${center})`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--color-muted)"
            strokeWidth={thickness}
          />
          {total > 0
            ? segments.map((seg) => {
                const value = Math.max(0, seg.value);
                if (value === 0) return null;
                const dash = (value / total) * circumference;
                const circle = (
                  <circle
                    key={seg.key}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={toneColorVar(seg.tone)}
                    strokeWidth={thickness}
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={-offset}
                    strokeLinecap="butt"
                  />
                );
                offset += dash;
                return circle;
              })
            : null}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums text-foreground">
          {centerValue ?? String(total)}
        </span>
        {centerLabel ? (
          <span className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
            {centerLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
