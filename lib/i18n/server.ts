import { cookies } from "next/headers";
import frMessages from "@/messages/fr.json";
import enMessages from "@/messages/en.json";
import { interpolate, lookup, type Messages } from "./dict";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./locales";

const SERVER_MESSAGES_BY_LOCALE: Partial<Record<Locale, Messages>> = {
  fr: frMessages as Messages,
  en: enMessages as Messages,
};

/**
 * Resolve the active locale on the server. Reads from the cookie set by the
 * `<I18nProvider>`, falling back to `DEFAULT_LOCALE`.
 */
export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Server-side equivalent of `useTranslations()`. Use this inside `Metadata`
 * factories, layouts, and other server components that need to render strings.
 */
export async function getTranslations(): Promise<
  (key: string, params?: Record<string, string | number>) => string
> {
  const locale = await getServerLocale();
  const messages =
    SERVER_MESSAGES_BY_LOCALE[locale] ??
    SERVER_MESSAGES_BY_LOCALE[DEFAULT_LOCALE] ??
    {};
  return (key, params) => {
    const template = lookup(messages, key);
    if (template === null) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[i18n] missing key "${key}" for locale "${locale}"`);
      }
      return key;
    }
    return interpolate(template, params);
  };
}
