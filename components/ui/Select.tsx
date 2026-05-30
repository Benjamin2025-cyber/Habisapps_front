"use client";

import ReactSelect, { components } from "react-select";
import { cn } from "@/lib/cn";

export type SelectOption = {
  value: string;
  label: string;
};

type SelectSize = "sm" | "md";

type SelectProps = {
  id?: string;
  name?: string;
  label?: string;
  options: ReadonlyArray<SelectOption>;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Surfaces a red border + helper line. */
  error?: string | null;
  /** Helper text below the field. Hidden when `error` is set. */
  hint?: string;
  /** `md` matches TextField (h-14). `sm` (h-11) for filter rows. */
  size?: SelectSize;
  /** Allow the user to clear the value via the × control. */
  isClearable?: boolean;
  /** Show the search input inside the dropdown. */
  isSearchable?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

const HEIGHTS: Record<SelectSize, string> = {
  sm: "min-h-11 h-11",
  md: "min-h-14 h-14",
};

/**
 * Shared `classNames` for our react-select wrappers (sync `Select` and the
 * async `AsyncSelect`), so both render identically against the design tokens.
 */
export function buildSelectClassNames(config: {
  size: SelectSize;
  error?: string | null;
  disabled?: boolean;
}) {
  const { size, error, disabled } = config;
  return {
    control: ({ isFocused }: { isFocused: boolean }) =>
      cn(
        "flex items-center rounded-[var(--radius-field)] border bg-background px-3 text-base text-foreground transition-colors",
        HEIGHTS[size],
        error
          ? "border-danger"
          : isFocused
            ? "border-foreground/30 ring-2 ring-ring/10"
            : "border-input",
        disabled && "cursor-not-allowed opacity-60",
      ),
    valueContainer: () => "gap-1 px-0 py-0",
    placeholder: () => "text-base text-muted-foreground/80",
    singleValue: () => "text-base text-foreground",
    input: () => "text-base text-foreground caret-foreground",
    indicatorsContainer: () => "gap-1",
    dropdownIndicator: () => "text-muted-foreground p-1",
    clearIndicator: () =>
      "text-muted-foreground hover:text-foreground p-1 cursor-pointer",
    menu: () =>
      "mt-1 overflow-hidden rounded-[var(--radius-field)] border border-border bg-background shadow-[0_24px_60px_-30px_rgba(20,6,47,0.30)]",
    menuList: () => "py-1 max-h-72",
    option: ({
      isFocused,
      isSelected,
    }: {
      isFocused: boolean;
      isSelected: boolean;
    }) =>
      cn(
        "px-3 py-2 text-sm cursor-pointer transition-colors",
        isSelected
          ? "bg-accent/15 font-semibold text-foreground"
          : isFocused
            ? "bg-muted/40 text-foreground"
            : "text-foreground",
      ),
    noOptionsMessage: () => "px-3 py-3 text-sm text-muted-foreground",
    loadingMessage: () => "px-3 py-3 text-sm text-muted-foreground",
  };
}

/**
 * Single-select dropdown built on `react-select` v5 (headless, accessible,
 * keyboard-navigable, with built-in search). Exposes a string `value` so
 * call sites work the same as our previous native-select wrapper.
 *
 * Styling is driven by `unstyled + classNames` so every part of the control
 * picks up Tailwind utilities consistent with `TextField` / our design tokens.
 */
export function Select({
  id,
  name,
  label,
  options,
  value,
  onChange,
  placeholder,
  error,
  hint,
  size = "md",
  isClearable = false,
  isSearchable = true,
  disabled,
  required,
  className,
}: SelectProps) {
  const selected = options.find((option) => option.value === value) ?? null;

  const helperId = error
    ? `${id ?? name ?? "select"}-error`
    : hint
      ? `${id ?? name ?? "select"}-hint`
      : undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
      ) : null}

      <ReactSelect<SelectOption, false>
        instanceId={id ?? name}
        inputId={id}
        name={name}
        unstyled
        options={options as SelectOption[]}
        value={selected}
        onChange={(option) => onChange(option?.value ?? "")}
        placeholder={placeholder ?? "—"}
        isClearable={isClearable}
        isSearchable={isSearchable}
        isDisabled={disabled}
        required={required}
        aria-describedby={helperId}
        menuPortalTarget={
          typeof document !== "undefined" ? document.body : undefined
        }
        menuPosition="fixed"
        components={{ IndicatorSeparator: null }}
        classNames={buildSelectClassNames({ size, error, disabled })}
        styles={MENU_PORTAL_STYLE}
      />

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

// Floating menu above modal/drawer overlays. Without this z-index hint
// react-select's portal can render below the Drawer (z-50).
// Typed loosely (`any`) because both single-select and multi-select callers
// share the same value; react-select's `StylesConfig` is generic per IsMulti.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MENU_PORTAL_STYLE: any = {
  menuPortal: (base: Record<string, unknown>) => ({ ...base, zIndex: 70 }),
};

// Re-export the upstream `components` namespace so callers can override
// individual parts (e.g. custom Option with badges) without re-importing
// react-select directly.
export { components as selectComponents };
