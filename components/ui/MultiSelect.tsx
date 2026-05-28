"use client";

import ReactSelect from "react-select";
import { cn } from "@/lib/cn";
import { MENU_PORTAL_STYLE } from "./Select";

export type MultiSelectOption = {
  value: string;
  label: string;
  description?: string;
  hint?: string;
};

type MultiSelectSize = "sm" | "md";

type Props = {
  id?: string;
  name?: string;
  label?: string;
  options: ReadonlyArray<MultiSelectOption>;
  selected: ReadonlyArray<string>;
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyOptionsLabel?: string;
  size?: MultiSelectSize;
  error?: string | null;
  hint?: string;
  isSearchable?: boolean;
  disabled?: boolean;
  className?: string;
};

const HEIGHTS: Record<MultiSelectSize, string> = {
  sm: "min-h-11",
  md: "min-h-14",
};

/**
 * Multi-select dropdown built on `react-select` v5 (`isMulti`). Same Tailwind
 * theming as `Select`; the trigger renders the selected items as chips
 * matching our accent palette, and the menu portals to `document.body` so it
 * never gets clipped by drawers / tables / overflow ancestors.
 */
export function MultiSelect({
  id,
  name,
  label,
  options,
  selected,
  onChange,
  placeholder,
  emptyOptionsLabel,
  size = "md",
  error,
  hint,
  isSearchable = true,
  disabled,
  className,
}: Props) {
  const selectedValues = options.filter((option) =>
    selected.includes(option.value),
  );

  const helperId = error
    ? `${id ?? name ?? "multiselect"}-error`
    : hint
      ? `${id ?? name ?? "multiselect"}-hint`
      : undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
      ) : null}

      <ReactSelect<MultiSelectOption, true>
        instanceId={id ?? name}
        inputId={id}
        name={name}
        unstyled
        isMulti
        closeMenuOnSelect={false}
        hideSelectedOptions={false}
        options={options as MultiSelectOption[]}
        value={selectedValues}
        onChange={(values) => onChange(values.map((option) => option.value))}
        placeholder={placeholder ?? "—"}
        isSearchable={isSearchable}
        isDisabled={disabled}
        aria-describedby={helperId}
        menuPortalTarget={
          typeof document !== "undefined" ? document.body : undefined
        }
        menuPosition="fixed"
        components={{ IndicatorSeparator: null }}
        noOptionsMessage={() => emptyOptionsLabel ?? "—"}
        formatOptionLabel={(option) => (
          <span className="flex flex-col">
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">
                {option.label}
              </span>
              {option.hint ? (
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {option.hint}
                </span>
              ) : null}
            </span>
            {option.description ? (
              <span className="mt-0.5 text-xs text-muted-foreground">
                {option.description}
              </span>
            ) : null}
          </span>
        )}
        classNames={{
          control: ({ isFocused }) =>
            cn(
              "flex items-center rounded-[var(--radius-field)] border bg-background px-3 py-1 text-base text-foreground transition-colors",
              HEIGHTS[size],
              error
                ? "border-danger"
                : isFocused
                  ? "border-foreground/30 ring-2 ring-ring/10"
                  : "border-input",
              disabled && "cursor-not-allowed opacity-60",
            ),
          valueContainer: () => "gap-1 px-0 py-0 flex-wrap",
          placeholder: () => "text-base text-muted-foreground/80",
          input: () => "text-base text-foreground caret-foreground",
          multiValue: () =>
            "flex items-center gap-1 rounded-full bg-accent/15 pl-2.5 pr-1 py-0.5 text-xs font-semibold text-accent",
          multiValueLabel: () => "text-xs font-semibold text-accent",
          multiValueRemove: () =>
            "rounded-full hover:bg-accent/25 px-1 text-accent cursor-pointer",
          indicatorsContainer: () => "gap-1",
          dropdownIndicator: () => "text-muted-foreground p-1",
          clearIndicator: () =>
            "text-muted-foreground hover:text-foreground p-1 cursor-pointer",
          menu: () =>
            "mt-1 overflow-hidden rounded-[var(--radius-field)] border border-border bg-background shadow-[0_24px_60px_-30px_rgba(20,6,47,0.30)]",
          menuList: () => "py-1 max-h-96",
          option: ({ isFocused, isSelected }) =>
            cn(
              "px-3 py-2.5 cursor-pointer transition-colors",
              isSelected
                ? "bg-accent/10"
                : isFocused
                  ? "bg-muted/40"
                  : "",
            ),
          noOptionsMessage: () => "px-3 py-3 text-sm text-muted-foreground",
        }}
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
