import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, ReactNode, WheelEventHandler } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Optional content rendered inside the field after the input (icons, action links, dividers). */
  trailing?: ReactNode;
  /** Field error message — renders red border + helper below. */
  error?: string | null;
  /** Helper text shown below the field. Hidden when `error` is set. */
  hint?: string;
};

export function TextField({
  id,
  label,
  trailing,
  error,
  hint,
  className,
  type = "text",
  onWheel,
  ...props
}: TextFieldProps) {
  // A focused `<input type="number">` treats the mouse wheel as a stepper, so
  // scrolling a long form past one silently changes it — by `step`, with no
  // visible cause. It cost a loan product a 10 % interest rate turned into 9 %
  // and a 10 % guarantee deposit turned into 9,99 % just by scrolling down to
  // the fields below. Blurring hands the wheel back to the page; the arrows and
  // keyboard still step deliberately.
  const handleWheel: WheelEventHandler<HTMLInputElement> = (event) => {
    if (type === "number") event.currentTarget.blur();
    onWheel?.(event);
  };

  const helperId = error
    ? `${id ?? props.name ?? "field"}-error`
    : hint
      ? `${id ?? props.name ?? "field"}-hint`
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
          type={type}
          className={cn(
            "flex-1 bg-transparent text-base text-foreground",
            "placeholder:text-muted-foreground/80",
            "focus:outline-none",
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={helperId}
          onWheel={handleWheel}
          {...props}
        />

        {trailing ? (
          <span className="flex shrink-0 items-center gap-3 text-muted-foreground">
            {trailing}
          </span>
        ) : null}
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
