import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/lib/i18n/locales";

/**
 * Resolve the locale to advertise to HabisApi on every request.
 *
 * HabisApi negotiates the response language from the `X-Locale` request header
 * (see its `SetApiLocale` middleware) and **defaults to English** when no header
 * is sent. This app is French-first, so we must always send the header or users
 * would get English `message` / validation strings back.
 *
 * In the browser we read the same cookie the `<I18nProvider>` writes
 * (`habis.locale`). During SSR `document` is unavailable, so we fall back to the
 * app default locale — which is also `fr`, matching the cookie default.
 */
export function getRequestLocale(): string {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`),
  );
  const value = match ? decodeURIComponent(match[1]) : null;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
