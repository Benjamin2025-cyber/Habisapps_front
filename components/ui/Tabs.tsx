"use client";

import { type ReactNode, useCallback, useRef } from "react";
import { cn } from "@/lib/cn";

export type TabItem = {
  id: string;
  label: string;
  /** Optional badge count rendered as a small accent pill next to the label. */
  badge?: number | string;
  /** Hide the tab entirely (e.g., when the user lacks the permission). */
  hidden?: boolean;
  /** Make the tab disabled (visible but not selectable). */
  disabled?: boolean;
};

type Props = {
  items: ReadonlyArray<TabItem>;
  activeId: string;
  onChange: (id: string) => void;
  /** Optional CSS class for the tab strip. */
  className?: string;
  /** Optional content rendered on the right side of the strip (e.g. action buttons). */
  toolbar?: ReactNode;
  /** Optional aria-label for the tablist. */
  ariaLabel?: string;
};

/**
 * Horizontal tab strip with accent underline. Tabs are keyboard-navigable
 * (Arrow Left/Right + Home/End); the active tab shows a bold magenta
 * underline. Hidden / disabled tabs are filtered out of focus traversal.
 *
 * Pair with conditional rendering on the active id, e.g.
 *   {activeId === "identity" ? <IdentityTab /> : null}
 */
export function Tabs({
  items,
  activeId,
  onChange,
  className,
  toolbar,
  ariaLabel,
}: Props) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const visibleItems = items.filter((item) => !item.hidden);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, currentId: string) => {
      const focusableTabs = visibleItems.filter((item) => !item.disabled);
      if (focusableTabs.length === 0) return;
      const currentIndex = focusableTabs.findIndex(
        (item) => item.id === currentId,
      );
      let nextIndex = currentIndex;
      if (event.key === "ArrowRight") {
        nextIndex = (currentIndex + 1) % focusableTabs.length;
      } else if (event.key === "ArrowLeft") {
        nextIndex =
          (currentIndex - 1 + focusableTabs.length) % focusableTabs.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = focusableTabs.length - 1;
      } else {
        return;
      }
      event.preventDefault();
      const nextTab = focusableTabs[nextIndex];
      onChange(nextTab.id);
      tabRefs.current[nextTab.id]?.focus();
    },
    [visibleItems, onChange],
  );

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border",
        className,
      )}
    >
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex flex-wrap items-center gap-1 overflow-x-auto"
      >
        {visibleItems.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[item.id] = node;
              }}
              role="tab"
              type="button"
              aria-selected={active}
              aria-controls={`${item.id}-panel`}
              id={`${item.id}-tab`}
              tabIndex={active ? 0 : -1}
              disabled={item.disabled}
              onClick={() => !item.disabled && onChange(item.id)}
              onKeyDown={(event) => handleKeyDown(event, item.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                active
                  ? "text-foreground"
                  : item.disabled
                    ? "cursor-not-allowed text-muted-foreground/50"
                    : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge !== null ? (
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent"
                />
              ) : null}
            </button>
          );
        })}
      </div>
      {toolbar ? <div className="flex shrink-0 items-center gap-2 pr-1">{toolbar}</div> : null}
    </div>
  );
}

/** Standardised panel container — pair one per tab id, mounted only when active. */
export function TabsPanel({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tabpanel"
      id={`${id}-panel`}
      aria-labelledby={`${id}-tab`}
      tabIndex={0}
      className={cn("focus:outline-none", className)}
    >
      {children}
    </div>
  );
}
