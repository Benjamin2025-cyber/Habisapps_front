import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type AlertVariant = "success" | "warning" | "danger" | "info";

type AlertProps = {
  variant: AlertVariant;
  title?: string;
  children: ReactNode;
  /** Optional action area rendered on the right (e.g. a retry link). */
  action?: ReactNode;
  className?: string;
};

const variantStyles: Record<
  AlertVariant,
  { container: string; icon: string; iconBg: string }
> = {
  success: {
    container: "border-success/25 bg-success/5",
    icon: "text-success",
    iconBg: "bg-success/15",
  },
  warning: {
    container: "border-warning/25 bg-warning/5",
    icon: "text-warning",
    iconBg: "bg-warning/15",
  },
  danger: {
    container: "border-danger/25 bg-danger/5",
    icon: "text-danger",
    iconBg: "bg-danger/15",
  },
  info: {
    container: "border-info/25 bg-info/5",
    icon: "text-info",
    iconBg: "bg-info/15",
  },
};

const variantText: Record<AlertVariant, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

export function Alert({ variant, title, children, action, className }: AlertProps) {
  const styles = variantStyles[variant];

  return (
    <div
      role={variant === "danger" || variant === "warning" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius-field)] border p-4",
        styles.container,
        className,
      )}
    >
      <span
        className={cn(
          "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          styles.iconBg,
          styles.icon,
        )}
      >
        <AlertIcon variant={variant} />
      </span>

      <div className="flex flex-1 flex-col gap-1 text-sm leading-snug">
        {title ? (
          <p className={cn("text-sm font-semibold", variantText[variant])}>{title}</p>
        ) : null}
        <div className="text-foreground/80">{children}</div>
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function AlertIcon({ variant }: { variant: AlertVariant }) {
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
