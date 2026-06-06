import { cn } from "@/lib/cn";

export type LineSeries = {
  label: string;
  /** Raw CSS colour (e.g. `var(--color-primary)`). */
  color: string;
  values: number[];
};

type Props = {
  series: LineSeries[];
  /** Pre-formatted x-axis labels, aligned to the value index. */
  xLabels: string[];
  height?: number;
  /** Format the y-axis max caption (e.g. money). */
  formatValue?: (value: number) => string;
  className?: string;
};

const VIEW_W = 1000;
const PAD_Y = 10;

/**
 * Dependency-free multi-series line chart (SVG). Uses a fixed 1000×H coordinate
 * space stretched to the container with `preserveAspectRatio="none"`; strokes
 * keep their width via `vector-effect="non-scaling-stroke"`. Areas are a faint
 * fill under each line. Designed for the operational balance/collection trend.
 */
export function DashboardLineChart({
  series,
  xLabels,
  height = 224,
  formatValue,
  className,
}: Props) {
  const count = Math.max(...series.map((s) => s.values.length), 0);
  const allValues = series.flatMap((s) => s.values);
  const max = Math.max(1, ...allValues);
  const usableH = height - PAD_Y * 2;

  const x = (i: number) => (count <= 1 ? VIEW_W / 2 : (i / (count - 1)) * VIEW_W);
  const y = (v: number) => PAD_Y + (1 - Math.max(0, v) / max) * usableH;

  // Sparse x labels: first, ~middle, last (avoid crowding).
  const labelIdx =
    xLabels.length <= 4
      ? xLabels.map((_, i) => i)
      : [0, Math.floor((xLabels.length - 1) / 2), xLabels.length - 1];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative" style={{ height }}>
        {formatValue ? (
          <span className="absolute left-0 top-0 text-[0.7rem] tabular-nums text-muted-foreground">
            {formatValue(max)}
          </span>
        ) : null}
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${VIEW_W} ${height}`}
          preserveAspectRatio="none"
          role="img"
        >
          {/* gridlines */}
          {[0, 1, 2, 3].map((k) => {
            const gy = PAD_Y + (k / 3) * usableH;
            return (
              <line
                key={k}
                x1={0}
                y1={gy}
                x2={VIEW_W}
                y2={gy}
                stroke="var(--color-border)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {series.map((s) => {
            if (s.values.length === 0) return null;
            const line = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
            const area = `${x(0)},${height - PAD_Y} ${line} ${x(s.values.length - 1)},${height - PAD_Y}`;
            return (
              <g key={s.label}>
                <polygon points={area} fill={s.color} opacity={0.08} />
                <polyline
                  points={line}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {xLabels.length > 0 ? (
        <div className="flex justify-between text-[0.7rem] text-muted-foreground">
          {labelIdx.map((i) => (
            <span key={i} className="tabular-nums">
              {xLabels[i]}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
