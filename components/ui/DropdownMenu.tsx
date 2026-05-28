"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

export type DropdownMenuItem =
  | {
      kind?: "item";
      label: string;
      onClick: () => void;
      disabled?: boolean;
      destructive?: boolean;
    }
  | { kind: "separator" }
  | { kind: "label"; label: string };

type Props = {
  /** Visible content of the trigger button (typically an icon). */
  trigger: ReactNode;
  /** aria-label for the trigger. Localized. */
  triggerLabel: string;
  items: ReadonlyArray<DropdownMenuItem>;
  /** Align the dropdown to the left or right edge of the trigger. */
  align?: "left" | "right";
  /** Tailwind width class for the dropdown panel. */
  widthClassName?: string;
  /** Extra CSS for the trigger button. */
  triggerClassName?: string;
};

/**
 * Portal-mounted dropdown menu. The trigger is a small icon button; the menu
 * panel is rendered at `document.body` and positioned via `getBoundingClientRect`,
 * so it never gets clipped by table / overflow ancestors. Closes on outside
 * click, Escape, scroll, or resize.
 */
export function DropdownMenu({
  trigger,
  triggerLabel,
  items,
  align = "right",
  widthClassName,
  triggerClassName,
}: Props) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left?: number; right?: number } | null>(
    null,
  );

  // Recompute position right before paint to avoid a flicker at the wrong spot.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const next: { top: number; left?: number; right?: number } = {
      top: rect.bottom + 4,
    };
    if (align === "right") {
      next.right = Math.max(8, window.innerWidth - rect.right);
    } else {
      next.left = Math.max(8, rect.left);
    }
    setPosition(next);
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function handleViewportChange() {
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-field)] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-muted text-foreground",
          triggerClassName,
        )}
      >
        {trigger}
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                right: position.right,
                zIndex: 60,
              }}
              className={cn(
                "overflow-hidden rounded-[var(--radius-field)] border border-border bg-background text-left shadow-[0_24px_60px_-30px_rgba(20,6,47,0.30)]",
                widthClassName ?? "w-56",
              )}
            >
              {items.map((item, index) => {
                if ((item as { kind?: string }).kind === "separator") {
                  return (
                    <div
                      key={`sep-${index}`}
                      className="border-t border-border"
                    />
                  );
                }
                if ((item as { kind?: string }).kind === "label") {
                  const labelItem = item as { label: string };
                  return (
                    <div
                      key={`label-${index}`}
                      className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {labelItem.label}
                    </div>
                  );
                }
                const entry = item as {
                  label: string;
                  onClick: () => void;
                  disabled?: boolean;
                  destructive?: boolean;
                };
                return (
                  <button
                    key={`item-${index}`}
                    type="button"
                    role="menuitem"
                    disabled={entry.disabled}
                    onClick={() => {
                      if (entry.disabled) return;
                      entry.onClick();
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center px-3 py-2 text-xs font-medium",
                      entry.disabled
                        ? "cursor-not-allowed text-muted-foreground/60"
                        : entry.destructive
                          ? "text-danger hover:bg-danger/10"
                          : "text-foreground hover:bg-muted",
                    )}
                  >
                    {entry.label}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
