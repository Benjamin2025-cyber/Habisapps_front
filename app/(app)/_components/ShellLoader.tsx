"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { useTranslations } from "@/lib/i18n/I18nProvider";

export function ShellLoader() {
  const t = useTranslations();
  return (
    <main
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center"
    >
      <BrandLogo wordmarkClassName="text-2xl" iconClassName="h-10 w-10" />
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
        <span>{t("shell.loading")}</span>
      </div>
    </main>
  );
}
