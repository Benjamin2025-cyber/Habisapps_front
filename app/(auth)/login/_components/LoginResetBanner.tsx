"use client";

import { Alert } from "@/components/ui/Alert";
import { useTranslations } from "@/lib/i18n/I18nProvider";

export function LoginResetBanner() {
  const t = useTranslations();
  return (
    <div className="mb-6">
      <Alert variant="success" title={t("auth.login.resetSuccess.title")}>
        {t("auth.login.resetSuccess.body")}
      </Alert>
    </div>
  );
}
