import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { cookies } from "next/headers";
import { SessionProvider } from "@/lib/auth/SessionProvider";
import { ToastProvider } from "@/lib/toast/ToastProvider";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  type Locale,
} from "@/lib/i18n/locales";
import frMessages from "@/messages/fr.json";
import enMessages from "@/messages/en.json";
import "./globals.css";

// Manrope: a modern, professional sans with excellent tabular figures — well
// suited to a finance dashboard. Variable font (200–800) covers every Tailwind
// weight used in the app. Exposed as `--font-sans` (see globals.css).
const sans = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "HabisLoan",
    template: "%s · HabisLoan",
  },
  description: "Plateforme de gestion microfinance Habibi.",
};

const MESSAGES_BY_LOCALE = {
  fr: frMessages,
  en: enMessages,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return (
    <html lang={locale} className={sans.variable}>
      <body className="min-h-full">
        <I18nProvider
          initialLocale={locale}
          messagesByLocale={MESSAGES_BY_LOCALE}
        >
          <ToastProvider>
            <SessionProvider>{children}</SessionProvider>
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
