"use client";

import { useTranslations } from "@/lib/i18n/I18nProvider";
import { ReportsHub } from "../_components/ReportsHub";

/** P24 — Édition › Balance des comptes (report-runs comptables). */
export default function ReportsBalancePage() {
  const t = useTranslations();
  return (
    <ReportsHub
      types={["trial_balance", "general_ledger", "emf_trial_balance"]}
      title={t("reports.scopes.balance.title")}
      description={t("reports.scopes.balance.description")}
    />
  );
}
