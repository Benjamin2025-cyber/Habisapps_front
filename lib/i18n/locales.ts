/**
 * Supported locales. Adding a new one is a 2-step process:
 *   1. Add a `messages/<code>.json` (copy `fr.json`, translate values).
 *   2. Add an entry to `LOCALES` below and flip `available: true`.
 * Nothing else in the codebase should need to change.
 */

export type Locale = "fr" | "en";

export const DEFAULT_LOCALE: Locale = "fr";

export const LOCALE_COOKIE = "habis.locale";

export const LOCALES: ReadonlyArray<{
  code: Locale;
  label: string;
  intlLocale: string;
  available: boolean;
}> = [
  { code: "fr", label: "Français", intlLocale: "fr-FR", available: true },
  { code: "en", label: "English", intlLocale: "en-GB", available: false },
];

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "fr" || value === "en";
}

export function intlLocaleFor(locale: Locale): string {
  return LOCALES.find((entry) => entry.code === locale)?.intlLocale ?? "fr-FR";
}
