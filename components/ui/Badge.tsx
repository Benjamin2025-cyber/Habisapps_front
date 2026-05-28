import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent";

type Props = {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
};

const toneStyles: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  info: "bg-info/15 text-info",
  accent: "bg-accent/15 text-accent",
};

/** Small inline pill, e.g. for table status cells. */
export function Badge({ tone = "neutral", children, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        toneStyles[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
