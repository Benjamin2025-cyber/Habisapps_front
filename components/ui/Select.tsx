import { cn } from "@/lib/cn";
import type { SelectHTMLAttributes } from "react";
import { ChevronDownIcon } from "./icons";

type SelectOption = {
  value: string;
  label: string;
};

type SelectSize = "sm" | "md";

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children" | "size"> & {
  label?: string;
  options: ReadonlyArray<SelectOption>;
  /** Placeholder option rendered first when value is empty. */
  placeholder?: string;
  error?: string | null;
  hint?: string;
  /** Visual height. `md` matches TextField (h-14); `sm` matches filter rows (h-11). */
  size?: SelectSize;
};

const HEIGHTS: Record<SelectSize, string> = {
  sm: "h-11",
  md: "h-14",
};

/**
 * Thin wrapper around the native `<select>` styled to match `TextField`.
 * No fancy combobox behaviour — keeps keyboard/accessibility for free.
 */
export function Select({
  id,
  label,
  options,
  placeholder,
  error,
  hint,
  className,
  value,
  size = "md",
  ...props
}: SelectProps) {
  const helperId = error
    ? `${id ?? props.name ?? "select"}-error`
    : hint
      ? `${id ?? props.name ?? "select"}-hint`
      : undefined;

  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
      ) : null}

      <div
        className={cn(
          "relative flex items-center rounded-[var(--radius-field)]",
          HEIGHTS[size],
          "border bg-background transition-colors",
          error
            ? "border-danger focus-within:border-danger focus-within:ring-2 focus-within:ring-danger/20"
            : "border-input focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-ring/10",
          className,
        )}
      >
        <select
          id={id}
          value={value ?? ""}
          className={cn(
            "flex-1 appearance-none bg-transparent px-4 pr-10 text-base text-foreground",
            "focus:outline-none",
            value === "" || value === undefined
              ? "text-muted-foreground/80"
              : "",
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={helperId}
          {...props}
        >
          {placeholder !== undefined ? (
            <option value="">{placeholder}</option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 h-4 w-4 text-muted-foreground" />
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
