"use client";

import { useTranslations } from "@/lib/i18n/I18nProvider";
import { ReportsHub } from "../_components/ReportsHub";

/** P24 — Édition › PAR (portefeuille à risque). */
export default function ReportsParPage() {
  const t = useTranslations();
  return (
    <ReportsHub
      types={["credit_par_delinquency"]}
      title={t("reports.scopes.par.title")}
      description={t("reports.scopes.par.description")}
    />
  );
}
