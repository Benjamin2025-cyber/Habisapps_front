"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

type Props = {
  open: boolean;
  title: string;
  /** Short message explaining what will happen. */
  description?: string;
  /** Optional extra content (e.g. a summary block). */
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** Confirm button style — `danger` for destructive actions. */
  tone?: "primary" | "danger";
  /** Disables buttons and shows the busy label while the action runs. */
  loading?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * Centered confirmation modal. Portal-mounted above the shell; closes on
 * backdrop click or Escape (unless busy). Use before destructive or bulk
 * actions to require an explicit confirmation.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  tone = "primary",
  loading = false,
  busyLabel,
  onConfirm,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) onClose();
    }
    document.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, loading, onClose]);

  if (typeof document === "undefined" || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        role="presentation"
        onClick={loading ? undefined : onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className={cn(
          "relative z-10 flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-card)]",
          "border border-border bg-background p-5 shadow-2xl",
        )}
      >
        <div className="flex flex-col gap-1.5">
          <h2
            id="confirm-dialog-title"
            className="text-base font-semibold text-foreground"
          >
            {title}
          </h2>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>

        {children ? <div className="text-sm text-foreground">{children}</div> : null}

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="md"
            type="button"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={tone}
            size="md"
            type="button"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (busyLabel ?? confirmLabel) : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
