"use client";

import { useTranslations } from "@/lib/i18n/I18nProvider";
import { ReportsHub } from "../_components/ReportsHub";

/**
 * P24 — Édition › Compte de résultat.
 *
 * The eight PCEMF soldes intermédiaires de gestion (80 to 87), computed from
 * classes 6 and 7. No class 8 account exists to post to, so this report is the
 * only place those figures are produced. Leaving the agency unset asks for the
 * institution's result across every agency, which the API gates on
 * `ledger.scope.institution.read`.
 */
export default function ReportsIncomeStatementPage() {
  const t = useTranslations();
  return (
    <ReportsHub
      types={["income_statement"]}
      title={t("reports.scopes.incomeStatement.title")}
      description={t("reports.scopes.incomeStatement.description")}
    />
  );
}
