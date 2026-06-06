import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { ChevronRightIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { TONE_CHIP, type Tone } from "./dashboard-tokens";

type Props = {
  title: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  tone?: Tone;
  /** Right-aligned link in the header (e.g. "Voir tout"). */
  action?: { href: string; label: string };
  /** Arbitrary right-aligned header slot (overrides `action` styling needs). */
  headerSlot?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

/**
 * Standard dashboard card shell: a header (optional tinted icon + title +
 * optional action link) above a body. Keeps every role dashboard visually
 * consistent with the teller layout's card chrome.
 */
export function DashboardCard({
  title,
  icon: Icon,
  tone = "accent",
  action,
  headerSlot,
  children,
  className,
  bodyClassName,
}: Props) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-[var(--radius-card)] border border-border bg-background",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {Icon ? (
            <span
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-field)]",
                TONE_CHIP[tone],
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
          {title}
        </h2>
        {headerSlot ??
          (action ? (
            <Link
              href={action.href}
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              {action.label}
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </Link>
          ) : null)}
      </header>
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
