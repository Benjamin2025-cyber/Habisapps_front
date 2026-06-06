"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsPanel, type TabItem } from "@/components/ui/Tabs";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { PageHeader } from "../../_components/PageHeader";
import { CodesTab } from "./_components/CodesTab";
import { MappingsTab } from "./_components/MappingsTab";

type TabId = "codes" | "mappings";

/**
 * P16b — Comptabilité › Codes opération & imputations. Deux onglets : le
 * référentiel des **codes d'opération** (CRUD `operation-codes`) et les
 * **imputations** comptables (CRUD `operation-account-mappings`) qui rattachent
 * chaque code à un compte débit/crédit du plan comptable.
 */
export default function OperationCodesPage() {
  const t = useTranslations();
  const session = useSession();

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const codesView = useCanAny(["operation.codes.view"]);
  const mappingsView = useCanAny(["operation.mappings.view"]);
  const canViewCodes = isPlatformAdmin || codesView;
  const canViewMappings = isPlatformAdmin || mappingsView;

  const [activeTab, setActiveTab] = useState<TabId>(
    canViewCodes ? "codes" : "mappings",
  );

  const tabs = useMemo<TabItem[]>(
    () => [
      { id: "codes", label: t("operationCodes.tabs.codes"), hidden: !canViewCodes },
      {
        id: "mappings",
        label: t("operationCodes.tabs.mappings"),
        hidden: !canViewMappings,
      },
    ],
    [t, canViewCodes, canViewMappings],
  );

  if (session.status !== "authenticated" || (!canViewCodes && !canViewMappings)) {
    return null;
  }

  return (
    <>
      <PageHeader
        title={t("operationCodes.pageTitle")}
        description={t("operationCodes.pageDescription")}
      />

      <Tabs
        items={tabs}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
        ariaLabel={t("operationCodes.tabsAriaLabel")}
      />

      {activeTab === "codes" && canViewCodes ? (
        <TabsPanel id="codes">
          <CodesTab />
        </TabsPanel>
      ) : null}

      {activeTab === "mappings" && canViewMappings ? (
        <TabsPanel id="mappings">
          <MappingsTab />
        </TabsPanel>
      ) : null}
    </>
  );
}
