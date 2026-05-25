"use client";

import { cn } from "@/lib/cn";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { Toast, ToastVariant } from "@/lib/toast/ToastProvider";
import { useEffect, useState } from "react";

type ToasterProps = {
  toasts: Toast[];
  onDismiss: (id: string) => void;
};

const variantStyles: Record<
  ToastVariant,
  {
    /** Left accent bar */
    accent: string;
    /** Icon background tint */
    iconBg: string;
    /** Icon foreground */
    icon: string;
    /** Title color */
    title: string;
  }
> = {
  success: {
    accent: "bg-success",
    iconBg: "bg-success/15",
    icon: "text-success",
    title: "text-success",
  },
  danger: {
    accent: "bg-danger",
    iconBg: "bg-danger/15",
    icon: "text-danger",
    title: "text-danger",
  },
  warning: {
    accent: "bg-warning",
    iconBg: "bg-warning/15",
    icon: "text-warning",
    title: "text-warning",
  },
  info: {
    accent: "bg-info",
    iconBg: "bg-info/15",
    icon: "text-info",
    title: "text-info",
  },
};

export function Toaster({ toasts, onDismiss }: ToasterProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-3 px-4",
        "sm:inset-x-auto sm:right-6 sm:top-6 sm:items-end sm:px-0",
      )}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const t = useTranslations();
  const styles = variantStyles[toast.variant];
  const [open, setOpen] = useState(false);

  // Enter animation: mount → next paint sets `open` to true.
  useEffect(() => {
    const handle = window.requestAnimationFrame(() => setOpen(true));
    return () => window.cancelAnimationFrame(handle);
  }, []);

  function handleDismiss() {
    setOpen(false);
    // Match the duration in the CSS transition below before unmounting.
    window.setTimeout(() => onDismiss(toast.id), 180);
  }

  return (
    <div
      role={toast.variant === "danger" || toast.variant === "warning" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-[var(--radius-card)] border border-border bg-background",
        "shadow-[0_20px_50px_-25px_rgba(20,6,47,0.35)]",
        "transition duration-200 ease-out",
        open
          ? "translate-y-0 opacity-100 sm:translate-x-0"
          : "-translate-y-2 opacity-0 sm:translate-x-4 sm:translate-y-0",
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1", styles.accent)}
      />

      <div className="flex items-start gap-3 py-3 pl-5 pr-3">
        <span
          className={cn(
            "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            styles.iconBg,
            styles.icon,
          )}
        >
          <ToastIcon variant={toast.variant} />
        </span>

        <div className="flex flex-1 flex-col gap-0.5">
          {toast.title ? (
            <p className={cn("text-sm font-semibold", styles.title)}>{toast.title}</p>
          ) : null}
          {toast.description ? (
            <p className="text-sm text-foreground/80">{toast.description}</p>
          ) : null}

          {toast.action ? (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                handleDismiss();
              }}
              className="mt-1 self-start text-xs font-semibold text-accent hover:underline"
            >
              {toast.action.label}
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t("toast.dismissAriaLabel")}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor" as const,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-4 w-4",
    "aria-hidden": true,
  };

  if (variant === "success") {
    return (
      <svg {...common}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (variant === "danger") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
    );
  }
  if (variant === "warning") {
    return (
      <svg {...common}>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
