"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { interpolate, lookup, type Messages } from "./dict";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  intlLocaleFor,
  isLocale,
  type Locale,
} from "./locales";

type TranslateFn = (
  key: string,
  params?: Record<string, string | number>,
) => string;

type Formatter = {
  /** Locale-aware decimal/integer formatting. */
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** Currency formatter — defaults to XAF (FCFA). */
  currency: (
    value: number,
    options?: { currency?: string; minimumFractionDigits?: number },
  ) => string;
  /**
   * Currency formatter that takes a value in the **minor** unit and converts to
   * the major unit before formatting. The API uses `*_minor` fields for all
   * monetary amounts; with XAF's accounting scale of 2, divide by 100.
   */
  currencyMinor: (
    minor: number,
    options?: {
      currency?: string;
      /** Scale of the currency. Defaults to 2 (loan/account amounts). Pass 0 for physical cash counts. */
      scale?: number;
      minimumFractionDigits?: number;
    },
  ) => string;
  /** Compact `DD MMM YYYY` date. */
  date: (value: Date | string | number) => string;
  /** Full `DD MMM YYYY HH:mm` date+time. */
  dateTime: (value: Date | string | number) => string;
  /** Relative phrasing: "il y a 3 minutes". */
  relative: (value: Date | string | number) => string;
};

type I18nContextValue = {
  locale: Locale;
  intlLocale: string;
  setLocale: (next: Locale) => void;
  t: TranslateFn;
  format: Formatter;
};

const I18nContext = createContext<I18nContextValue | null>(null);

type ProviderProps = {
  initialLocale: Locale;
  /** Map of all loaded message bundles, keyed by locale code. */
  messagesByLocale: Partial<Record<Locale, Messages>>;
  children: ReactNode;
};

export function I18nProvider({
  initialLocale,
  messagesByLocale,
  children,
}: ProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const activeMessages = useMemo<Messages>(() => {
    return (
      messagesByLocale[locale] ??
      messagesByLocale[DEFAULT_LOCALE] ??
      {}
    );
  }, [locale, messagesByLocale]);

  const t = useCallback<TranslateFn>(
    (key, params) => {
      const template = lookup(activeMessages, key);
      if (template === null) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[i18n] missing key "${key}" for locale "${locale}"`);
        }
        return key;
      }
      return interpolate(template, params);
    },
    [activeMessages, locale],
  );

  const intlLocale = useMemo(() => intlLocaleFor(locale), [locale]);

  const format = useMemo<Formatter>(() => {
    return {
      number: (value, options) =>
        new Intl.NumberFormat(intlLocale, options).format(value),
      currency: (value, options) =>
        new Intl.NumberFormat(intlLocale, {
          style: "currency",
          currency: options?.currency ?? "XAF",
          minimumFractionDigits: options?.minimumFractionDigits ?? 0,
        }).format(value),
      currencyMinor: (minor, options) => {
        const scale = options?.scale ?? 2;
        const divisor = Math.pow(10, scale);
        return new Intl.NumberFormat(intlLocale, {
          style: "currency",
          currency: options?.currency ?? "XAF",
          minimumFractionDigits: options?.minimumFractionDigits ?? 0,
        }).format(minor / divisor);
      },
      date: (value) =>
        new Intl.DateTimeFormat(intlLocale, {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(coerceDate(value)),
      dateTime: (value) =>
        new Intl.DateTimeFormat(intlLocale, {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(coerceDate(value)),
      relative: (value) => formatRelative(intlLocale, coerceDate(value)),
    };
  }, [intlLocale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof document !== "undefined") {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      document.documentElement.lang = next;
    }
  }, []);

  // Keep `<html lang>` in sync if the provider initialized from a stale cookie.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, intlLocale, setLocale, t, format }),
    [locale, intlLocale, setLocale, t, format],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function coerceDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

function formatRelative(intlLocale: string, value: Date): string {
  const diffSeconds = Math.round((value.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" });
  const buckets: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  for (const [unit, factor] of buckets) {
    if (Math.abs(diffSeconds) >= factor) {
      return rtf.format(Math.round(diffSeconds / factor), unit);
    }
  }
  return rtf.format(diffSeconds, "second");
}

export function useTranslations(namespace?: string): TranslateFn {
  const ctx = useContext(I18nContext);
  if (ctx === null) {
    throw new Error("useTranslations must be used inside <I18nProvider>");
  }
  if (!namespace) return ctx.t;
  return (key, params) => ctx.t(`${namespace}.${key}`, params);
}

export function useLocale(): {
  locale: Locale;
  intlLocale: string;
  setLocale: (next: Locale) => void;
} {
  const ctx = useContext(I18nContext);
  if (ctx === null) {
    throw new Error("useLocale must be used inside <I18nProvider>");
  }
  return {
    locale: ctx.locale,
    intlLocale: ctx.intlLocale,
    setLocale: ctx.setLocale,
  };
}

export function useFormatter(): Formatter {
  const ctx = useContext(I18nContext);
  if (ctx === null) {
    throw new Error("useFormatter must be used inside <I18nProvider>");
  }
  return ctx.format;
}
