"use client";

import { cn } from "@/lib/cn";
import { LockIcon } from "@/components/ui/icons";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  /** Additional trailing content (e.g. "Oublié?" link). Rendered before the lock icon. */
  trailing?: ReactNode;
  /** Field error message — renders red border + helper below. */
  error?: string | null;
  /** Helper text shown below the field. Hidden when `error` is set. */
  hint?: string;
};

export function PasswordField({
  id,
  label,
  trailing,
  error,
  hint,
  className,
  ...props
}: PasswordFieldProps) {
  const t = useTranslations();
  const [revealed, setRevealed] = useState(false);
  const helperId = error
    ? `${id ?? props.name ?? "password"}-error`
    : hint
      ? `${id ?? props.name ?? "password"}-hint`
      : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>

      <div
        className={cn(
          "flex h-14 items-center gap-2 rounded-[var(--radius-field)]",
          "border bg-background px-4 transition-colors",
          error
            ? "border-danger focus-within:border-danger focus-within:ring-2 focus-within:ring-danger/20"
            : "border-input focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-ring/10",
          className,
        )}
      >
        <input
          id={id}
          type={revealed ? "text" : "password"}
          className={cn(
            "flex-1 bg-transparent text-base text-foreground",
            "placeholder:text-muted-foreground/80",
            "focus:outline-none",
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={helperId}
          {...props}
        />

        <span className="flex shrink-0 items-center gap-3 text-muted-foreground">
          {trailing}
          {trailing ? <span aria-hidden className="h-6 w-px bg-input" /> : null}
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            aria-label={
              revealed
                ? t("auth.shared.hidePassword")
                : t("auth.shared.showPassword")
            }
            aria-pressed={revealed}
            className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {revealed ? <EyeOffIcon /> : <LockIcon className="h-5 w-5" />}
          </button>
        </span>
      </div>

      {error ? (
        <p id={helperId} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={helperId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A11.5 11.5 0 0 1 12 5c5 0 9.27 3.11 11 7.5a13 13 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13 13 0 0 0 1 12.5c1.73 4.39 6 7.5 11 7.5a12 12 0 0 0 4.49-.87" />
      <path d="M2 2l20 20" />
    </svg>
  );
}
