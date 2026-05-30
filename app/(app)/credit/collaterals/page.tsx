"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Tabs, TabsPanel, type TabItem } from "@/components/ui/Tabs";
import { fetchLoans, type Loan } from "@/lib/api/loans";
import { localizeApiMessage } from "@/lib/api/errors";
import { useCan, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { usePermissionGuard } from "@/lib/auth/usePermissionGuard";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { PageHeader } from "../../_components/PageHeader";
import { LOAN_STATUS_TONE } from "../loans/_components/status";
import { GuarantorsObligationsTab } from "./_components/GuarantorsObligationsTab";
import { CollateralsTab } from "./_components/CollateralsTab";

type TabId = "guarantors" | "objects";

/**
 * P12 — Crédit › Garanties. Page autonome : on sélectionne d'abord un prêt,
 * puis deux onglets opèrent sur ses garanties — **Garants** (engagements de
 * caution, `guarantee-obligations`) et **Objets en garantie** (`collaterals` +
 * items, formulaire adaptatif au type). La libération n'est possible qu'après
 * clôture du prêt.
 */
export default function CollateralsPage() {
  const t = useTranslations();
  const session = useSession();
  const allowed = usePermissionGuard([
    "loans.collaterals.manage",
    "loans.guarantees.manage",
  ]);

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const canGuaranteesPerm = useCan("loans.guarantees.manage");
  const canCollateralsPerm = useCan("loans.collaterals.manage");
  const canGuarantees = isPlatformAdmin || canGuaranteesPerm;
  const canCollaterals = isPlatformAdmin || canCollateralsPerm;

  const token = session.status === "authenticated" ? session.token : null;

  const [loans, setLoans] = useState<Loan[]>([]);
  const [loansError, setLoansError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>(
    canGuarantees ? "guarantors" : "objects",
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchLoans(token, { perPage: 100 })
      .then((response) => {
        if (!cancelled) setLoans(response.data);
      })
      .catch((cause) => {
        if (!cancelled)
          setLoansError(
            cause instanceof Error ? cause.message : "Failed to load loans",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const loanOptions = useMemo(
    () =>
      loans.map((loan) => ({
        value: loan.public_id,
        label: `${loan.loan_number ?? loan.public_id} — ${t(`loans.status.${loan.status}`)}`,
      })),
    [loans, t],
  );

  const selectedLoan = useMemo(
    () => loans.find((l) => l.public_id === selectedId) ?? null,
    [loans, selectedId],
  );

  if (session.status !== "authenticated" || !allowed) return null;

  const loanClosed = selectedLoan?.status === "closed";

  const tabs: TabItem[] = [
    {
      id: "guarantors",
      label: t("guarantees.tabs.guarantors"),
      hidden: !canGuarantees,
    },
    {
      id: "objects",
      label: t("guarantees.tabs.objects"),
      hidden: !canCollaterals,
    },
  ];

  return (
    <>
      <PageHeader
        title={t("guarantees.pageTitle")}
        description={t("guarantees.pageDescription")}
      />

      {/* Loan selector */}
      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4">
        <label
          htmlFor="guarantees-loan"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t("guarantees.loanSelector.label")}
        </label>
        <Select
          id="guarantees-loan"
          value={selectedId}
          options={loanOptions}
          placeholder={t("guarantees.loanSelector.placeholder")}
          isClearable
          onChange={setSelectedId}
        />
        {loansError ? (
          <p className="text-xs text-danger">
            {localizeApiMessage(loansError)}
          </p>
        ) : null}

        {selectedLoan ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs">
            <Badge tone={LOAN_STATUS_TONE[selectedLoan.status]}>
              {t(`loans.status.${selectedLoan.status}`)}
            </Badge>
            {selectedLoan.client_public_id ? (
              <Link
                href={`/clients/${selectedLoan.client_public_id}`}
                className="font-semibold text-accent hover:underline"
              >
                {t("guarantees.loanSelector.viewClient")}
              </Link>
            ) : null}
            {!loanClosed ? (
              <span className="text-muted-foreground">
                {t("guarantees.loanSelector.releaseHint")}
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      {!selectedLoan ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          {t("guarantees.selectLoanPrompt")}
        </div>
      ) : (
        <>
          <Tabs
            items={tabs}
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as TabId)}
            ariaLabel={t("guarantees.tabsAriaLabel")}
          />

          {activeTab === "guarantors" && canGuarantees ? (
            <TabsPanel id="guarantors">
              <GuarantorsObligationsTab
                loan={selectedLoan}
                loanClosed={loanClosed}
              />
            </TabsPanel>
          ) : null}

          {activeTab === "objects" && canCollaterals ? (
            <TabsPanel id="objects">
              <CollateralsTab loan={selectedLoan} loanClosed={loanClosed} />
            </TabsPanel>
          ) : null}
        </>
      )}
    </>
  );
}
