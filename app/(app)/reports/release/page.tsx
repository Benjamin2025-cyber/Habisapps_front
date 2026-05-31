"use client";

import { useTranslations } from "@/lib/i18n/I18nProvider";
import { ReportsHub } from "../_components/ReportsHub";

/**
 * P24 — Édition › Main levée. Aucun type de rapport "main levée" n'est exposé
 * par l'API (types report-runs supportés : balance/grand livre/EMF/portefeuille/
 * PAR/recouvrement). Le hub affiche donc une note d'indisponibilité.
 */
export default function ReportsReleasePage() {
  const t = useTranslations();
  return (
    <ReportsHub
      types={[]}
      title={t("reports.scopes.release.title")}
      description={t("reports.scopes.release.description")}
    />
  );
}
