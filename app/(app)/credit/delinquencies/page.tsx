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
import { ClientPicker, type ClientOption } from "../../_components/ClientPicker";
import { LOAN_STATUS_TONE } from "../loans/_components/status";
import { DelinquencyTrackingsTab } from "./_components/DelinquencyTrackingsTab";
import { RecoveryAttemptsTab } from "./_components/RecoveryAttemptsTab";

type TabId = "trackings" | "recoveries";

/** Loan statuses on which a recovery attempt is allowed (API rule). */
const RECOVERABLE = new Set(["disbursed", "active", "rescheduled"]);

/**
 * P14 — Crédit › Suivi des exigibles. Page unique à deux onglets (décision #7) :
 * **Suivis** (`delinquency-trackings`, relances/rendez-vous) et **Recouvrements**
 * (`recovery-attempts`, prélèvements sur les comptes du client). On sélectionne
 * d'abord un prêt, puis on opère dans l'un des onglets.
 */
export default function DelinquenciesPage() {
  const t = useTranslations();
  const session = useSession();
  const allowed = usePermissionGuard([
    "loans.delinquency.manage",
    "loans.recoveries.manage",
  ]);

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const canDelinquencyPerm = useCan("loans.delinquency.manage");
  const canRecoveryPerm = useCan("loans.recoveries.manage");
  const canDelinquency = isPlatformAdmin || canDelinquencyPerm;
  const canRecovery = isPlatformAdmin || canRecoveryPerm;

  const token = session.status === "authenticated" ? session.token : null;

  const [loans, setLoans] = useState<Loan[]>([]);
  const [loansError, setLoansError] = useState<string | null>(null);
  const [client, setClient] = useState<ClientOption | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>(
    canDelinquency ? "trackings" : "recoveries",
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

  // Loans of the selected client only (the loans index has no client filter —
  // see back-issues; filtered client-side from the loaded set).
  const clientLoans = useMemo(
    () =>
      client ? loans.filter((l) => l.client_public_id === client.value) : [],
    [loans, client],
  );

  const loanOptions = useMemo(
    () =>
      clientLoans.map((loan) => ({
        value: loan.public_id,
        label: `${loan.loan_number ?? loan.public_id} — ${t(`loans.status.${loan.status}`)}`,
      })),
    [clientLoans, t],
  );

  function changeClient(option: ClientOption | null) {
    setClient(option);
    setSelectedId("");
  }

  const selectedLoan = useMemo(
    () => loans.find((l) => l.public_id === selectedId) ?? null,
    [loans, selectedId],
  );

  if (session.status !== "authenticated" || !allowed) return null;

  const loanRecoverable = selectedLoan
    ? RECOVERABLE.has(selectedLoan.status)
    : false;

  const tabs: TabItem[] = [
    {
      id: "trackings",
      label: t("delinquencies.tabs.trackings"),
      hidden: !canDelinquency,
    },
    {
      id: "recoveries",
      label: t("delinquencies.tabs.recoveries"),
      hidden: !canRecovery,
    },
  ];

  return (
    <>
      <PageHeader
        title={t("delinquencies.pageTitle")}
        description={t("delinquencies.pageDescription")}
      />

      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4">
        <ClientPicker
          label={t("delinquencies.clientSelector.label")}
          value={client}
          onChange={changeClient}
          placeholder={t("delinquencies.clientSelector.placeholder")}
          hint={t("delinquencies.clientSelector.hint")}
          required
        />
        <div>
          <label
            htmlFor="delinquencies-loan"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {t("delinquencies.loanSelector.label")}
          </label>
          <Select
            id="delinquencies-loan"
            className="mt-2"
            value={selectedId}
            options={loanOptions}
            placeholder={
              client
                ? t("delinquencies.loanSelector.placeholder")
                : t("delinquencies.loanSelector.needClient")
            }
            isClearable
            onChange={setSelectedId}
            disabled={!client}
          />
        </div>
        {loansError ? (
          <p className="text-xs text-danger">{localizeApiMessage(loansError)}</p>
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
                {t("delinquencies.loanSelector.viewClient")}
              </Link>
            ) : null}
            {!loanRecoverable ? (
              <span className="text-muted-foreground">
                {t("delinquencies.loanSelector.notRecoverable")}
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      {!client ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          {t("delinquencies.selectClientPrompt")}
        </div>
      ) : !selectedLoan ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          {t("delinquencies.selectLoanPrompt")}
        </div>
      ) : (
        <>
          <Tabs
            items={tabs}
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as TabId)}
            ariaLabel={t("delinquencies.tabsAriaLabel")}
          />

          {activeTab === "trackings" && canDelinquency ? (
            <TabsPanel id="trackings">
              <DelinquencyTrackingsTab loan={selectedLoan} />
            </TabsPanel>
          ) : null}

          {activeTab === "recoveries" && canRecovery ? (
            <TabsPanel id="recoveries">
              <RecoveryAttemptsTab
                loan={selectedLoan}
                recoverable={loanRecoverable}
              />
            </TabsPanel>
          ) : null}
        </>
      )}
    </>
  );
}
