"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useTranslations } from "@/lib/i18n/I18nProvider";

export function ActivationSuccess() {
  const t = useTranslations();
  const router = useRouter();

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-primary">
          {t("auth.activate.success.heading")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.activate.success.body")}
        </p>
      </header>

      <Button size="lg" onClick={() => router.replace("/login")}>
        {t("auth.activate.success.cta")}
      </Button>
    </div>
  );
}
