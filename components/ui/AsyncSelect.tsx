"use client";

import AsyncReactSelect from "react-select/async";
import { buildSelectClassNames, MENU_PORTAL_STYLE } from "./Select";
import { cn } from "@/lib/cn";

export type AsyncSelectOption = {
  value: string;
  label: string;
};

type AsyncSelectSize = "sm" | "md";

type Props<O extends AsyncSelectOption> = {
  id?: string;
  name?: string;
  label?: string;
  /** Selected option (full object — async menus can't resolve a bare value). */
  value: O | null;
  onChange: (option: O | null) => void;
  /**
   * Resolve options for the typed input. Callback style so callers can debounce
   * (react-select invokes this on every keystroke otherwise).
   */
  loadOptions: (input: string, callback: (options: O[]) => void) => void;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  size?: AsyncSelectSize;
  /** `true` loads the initial list on focus; an array seeds static defaults. */
  defaultOptions?: boolean | O[];
  isClearable?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** Text shown when a search returns nothing. */
  noOptionsMessage?: string;
  loadingMessage?: string;
  className?: string;
};

/**
 * Async, server-search single-select built on `react-select/async`. Visually
 * identical to {@link Select} (shares `buildSelectClassNames`), but fetches its
 * options from a backend as the user types instead of filtering a static list.
 * Generic over the option type so callers can attach extra fields to options.
 */
export function AsyncSelect<O extends AsyncSelectOption>({
  id,
  name,
  label,
  value,
  onChange,
  loadOptions,
  placeholder,
  error,
  hint,
  size = "md",
  defaultOptions = true,
  isClearable = false,
  disabled,
  required,
  noOptionsMessage,
  loadingMessage,
  className,
}: Props<O>) {
  const helperId = error
    ? `${id ?? name ?? "async-select"}-error`
    : hint
      ? `${id ?? name ?? "async-select"}-hint`
      : undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
      ) : null}

      <AsyncReactSelect<O, false>
        instanceId={id ?? name}
        inputId={id}
        name={name}
        unstyled
        value={value}
        onChange={(option) => onChange((option as O | null) ?? null)}
        loadOptions={loadOptions}
        defaultOptions={defaultOptions}
        cacheOptions
        placeholder={placeholder ?? "—"}
        isClearable={isClearable}
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
        noOptionsMessage={({ inputValue }) =>
          inputValue
            ? noOptionsMessage ?? "Aucun résultat."
            : noOptionsMessage ?? "Saisissez pour rechercher…"
        }
        loadingMessage={() => loadingMessage ?? "Recherche…"}
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
