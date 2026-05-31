"use client";

import { useTranslations } from "@/lib/i18n/I18nProvider";
import { ReportsHub } from "../_components/ReportsHub";

/** P24 — Édition › Exigible / encours crédit. */
export default function ReportsExigiblePage() {
  const t = useTranslations();
  return (
    <ReportsHub
      types={["credit_portfolio_outstanding"]}
      title={t("reports.scopes.exigible.title")}
      description={t("reports.scopes.exigible.description")}
    />
  );
}
