"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsPanel, type TabItem } from "@/components/ui/Tabs";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { PageHeader } from "../../_components/PageHeader";
import { ProceduresTab } from "./_components/ProceduresTab";
import { RunsTab } from "./_components/RunsTab";

type TabId = "procedures" | "runs";

/**
 * P26 — Paramétrage › Batch. Deux onglets : le **référentiel des procédures**
 * (CRUD `batch-procedures`) et les **exécutions** (`batch-runs` : créer →
 * exécuter / relancer / annuler, avec résultat). L'onglet Exécutions n'apparaît
 * que si l'acteur peut voir les runs.
 */
export default function BatchPage() {
  const t = useTranslations();
  const session = useSession();

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const proceduresView = useCanAny([
    "batch.procedures.view",
    "batch.procedures.manage",
  ]);
  const runsView = useCanAny(["batch.runs.view", "batch.runs.manage"]);
  const canViewProcedures = isPlatformAdmin || proceduresView;
  const canViewRuns = isPlatformAdmin || runsView;

  const [activeTab, setActiveTab] = useState<TabId>("procedures");

  const tabs = useMemo<TabItem[]>(
    () => [
      { id: "procedures", label: t("batch.tabs.procedures") },
      { id: "runs", label: t("batch.tabs.runs"), hidden: !canViewRuns },
    ],
    [t, canViewRuns],
  );

  if (session.status !== "authenticated" || !canViewProcedures) return null;

  return (
    <>
      <PageHeader
        title={t("batch.pageTitle")}
        description={t("batch.pageDescription")}
      />

      <Tabs
        items={tabs}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
        ariaLabel={t("batch.tabsAriaLabel")}
      />

      {activeTab === "procedures" ? (
        <TabsPanel id="procedures">
          <ProceduresTab />
        </TabsPanel>
      ) : null}

      {activeTab === "runs" && canViewRuns ? (
        <TabsPanel id="runs">
          <RunsTab />
        </TabsPanel>
      ) : null}
    </>
  );
}
