"use client";

import type { InputHTMLAttributes } from "react";
import { TextField } from "@/components/ui/TextField";
import { amountInWords } from "@/lib/format/amountInWords";
import { useLocale } from "@/lib/i18n/I18nProvider";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | null;
  /** Fallback helper shown when the field is empty (the words replace it once typed). */
  hint?: string;
  /** Currency for the spelled-out amount. Defaults to XAF. */
  currency?: string;
};

/**
 * Money amount input. A numeric `TextField` that, as the user types, shows the
 * amount spelled out in words (locale-aware FR/EN) in the helper slot — e.g.
 * "150000" → "Cent cinquante mille francs CFA" / "One hundred and fifty
 * thousand CFA francs". Use it for every monetary amount input in the app.
 */
export function MoneyField({ currency = "XAF", hint, value, ...rest }: Props) {
  const { locale } = useLocale();
  const raw = typeof value === "number" ? String(value) : (value ?? "").toString();
  const major = Number(raw.trim());
  const minor =
    raw.trim().length > 0 && Number.isFinite(major) && major > 0
      ? Math.round(major * 100)
      : 0;
  const words = minor > 0 ? amountInWords(minor, currency, locale) : "";

  return (
    <TextField
      {...rest}
      type="number"
      inputMode="decimal"
      value={value}
      hint={words || hint}
    />
  );
}
