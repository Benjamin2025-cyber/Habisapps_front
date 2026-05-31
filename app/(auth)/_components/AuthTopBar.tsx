"use client";

import Link from "next/link";
import { InfoIcon } from "@/components/ui/icons";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

type AuthTopBarProps = {
  /** When true, shows a back arrow before the "À propos" link. */
  showBack?: boolean;
  /** Where the back arrow points. Defaults to the auth root. */
  backHref?: string;
};

export function AuthTopBar({ showBack = false, backHref = "/" }: AuthTopBarProps) {
  const t = useTranslations();
  return (
    <header className="flex items-center justify-between px-8 pt-8 sm:px-12 sm:pt-10">
      <div className="flex items-center gap-4">
        {showBack ? (
          <Link
            href={backHref}
            aria-label={t("common.back")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-accent hover:bg-muted"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
          </Link>
        ) : null}

        <Link
          href="/about"
          className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-foreground/80"
        >
          <InfoIcon className="h-4 w-4" />
          <span>{t("auth.topBar.about")}</span>
        </Link>
      </div>

      <LanguageSwitcher />
    </header>
  );
}
