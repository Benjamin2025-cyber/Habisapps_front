"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Sticky footer (typically Submit / Cancel buttons). */
  footer?: React.ReactNode;
  /** Optional subtitle below the title. */
  description?: string;
  /** Right-edge drawer width. Defaults to ~28rem on >= sm. */
  widthClassName?: string;
  children: React.ReactNode;
};

/**
 * Right-edge slide-in drawer. Portal-mounted to `document.body` so it sits
 * above the sidebar/topbar regardless of stacking context. Closes on
 * backdrop click or Escape.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  footer,
  widthClassName,
  children,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-hidden={!open}
      className={cn(
        "fixed inset-0 z-50 transition-opacity duration-200",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div
        role="presentation"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className={cn(
          "absolute right-0 top-0 flex h-full w-full flex-col bg-background shadow-2xl",
          "transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full",
          widthClassName ?? "sm:w-[32rem]",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div className="flex flex-col gap-1">
            <h2
              id="drawer-title"
              className="text-base font-semibold text-foreground"
            >
              {title}
            </h2>
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-field)] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M6 6l12 12" />
              <path d="M18 6l-12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-3">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}
