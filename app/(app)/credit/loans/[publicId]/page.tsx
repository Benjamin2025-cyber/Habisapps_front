"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsPanel, type TabItem } from "@/components/ui/Tabs";
import { getClient, type Client } from "@/lib/api/clients";
import {
  fetchLoanProducts,
  type LoanProduct,
} from "@/lib/api/loan-products";
import { fetchStaffUsers, type StaffUser } from "@/lib/api/staff-users";
import { fetchSectors, fetchSubSectors, type Sector, type SubSector } from "@/lib/api/sectors";
import {
  getLoan,
  updateLoan,
  type Loan,
  type LoanWritePayload,
} from "@/lib/api/loans";
import { localizeApiMessage } from "@/lib/api/errors";
import { useCan, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { usePermissionGuard } from "@/lib/auth/usePermissionGuard";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../../_components/PageHeader";
import { LoanDrawer } from "../_components/LoanDrawer";
import { LOAN_STATUS_TONE } from "../_components/status";
import { LoanInfoTab } from "./_components/LoanInfoTab";
import { LoanFinancialTab } from "./_components/LoanFinancialTab";
import { LoanScheduleTab } from "./_components/LoanScheduleTab";
import { LoanVisaStepper } from "./_components/LoanVisaStepper";
import { LoanStatusActions } from "./_components/LoanStatusActions";

type TabId = "infos" | "financial" | "schedule";

/**
 * P11 — Fiche prêt (mise en place). Statut en permanence, stepper de visa
 * vertical, et 3 onglets : Infos générales (édition tant que `application`),
 * Financières, Amortissement (génération du tableau). L'onglet Commentaires est
 * masqué tant que l'API n'expose pas `loans/{id}/comments`.
 */
export default function LoanDetailPage(props: {
  params: Promise<{ publicId: string }>;
}) {
  const params = use(props.params);
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();
  const allowed = usePermissionGuard(["loans.view"]);

  const canUpdate = useCan("loans.update");
  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const canSchedulePerm = useCan("loans.schedules.generate");
  const canGenerateSchedule = isPlatformAdmin || canSchedulePerm;

  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<Loan> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return getLoan(token, params.publicId);
    },
    [token, params.publicId],
  );

  const { data: loan, loading, error, refetch } = useApi(fetcher, [
    token,
    params.publicId,
  ]);

  const [activeTab, setActiveTab] = useState<TabId>("infos");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [subSectors, setSubSectors] = useState<SubSector[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([
      fetchLoanProducts(token, { perPage: 100 }).catch(() => null),
      fetchSectors(token, { perPage: 100 }).catch(() => null),
      fetchSubSectors(token, { perPage: 100 }).catch(() => null),
      fetchStaffUsers(token, { perPage: 100 }).catch(() => null),
    ]).then(([prod, sect, subs, staffUsers]) => {
      if (cancelled) return;
      setProducts(prod?.data ?? []);
      setSectors(sect ?? []);
      setSubSectors(subs ?? []);
      setStaff(staffUsers?.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Resolve the borrower for the info tab (name + link).
  const [client, setClient] = useState<Client | null>(null);
  useEffect(() => {
    if (!token || !loan?.client_public_id) {
      setClient(null);
      return;
    }
    let cancelled = false;
    getClient(token, loan.client_public_id)
      .then((c) => {
        if (!cancelled) setClient(c);
      })
      .catch(() => {
        if (!cancelled) setClient(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, loan?.client_public_id]);

  const creditAgentId = loan?.credit_agent_public_id ?? null;
  const creditAgentName = creditAgentId
    ? (staff.find((s) => s.public_id === creditAgentId)?.name ?? null)
    : null;

  async function handleEditSubmit(payload: LoanWritePayload) {
    if (!token || !loan) return;
    await updateLoan(token, loan.public_id, payload);
    toast.success(
      t("loans.toast.updatedTitle"),
      t("loans.toast.updatedBody", { number: loan.loan_number ?? "" }),
    );
    setDrawerOpen(false);
    refetch();
  }

  if (session.status !== "authenticated" || !allowed) return null;

  const canEditInfos = canUpdate && loan?.status === "application";

  const tabs: TabItem[] = [
    { id: "infos", label: t("loanDetail.tabs.infos") },
    { id: "financial", label: t("loanDetail.tabs.financial") },
    { id: "schedule", label: t("loanDetail.tabs.schedule") },
  ];

  return (
    <>
      <PageHeader
        title={
          loan ? (loan.loan_number ?? t("loanDetail.untitled")) : t("loanDetail.loading")
        }
        description={
          loan?.applied_on
            ? t("loanDetail.appliedLabel", { date: loan.applied_on })
            : undefined
        }
        actions={
          <Link
            href="/credit/loans"
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            ← {t("loanDetail.backToList")}
          </Link>
        }
      />

      {error ? (
        <Alert
          variant="danger"
          title={t("loanDetail.errorTitle")}
          action={
            <button
              type="button"
              onClick={refetch}
              className="text-xs font-semibold text-accent hover:underline"
            >
              {t("common.tryAgain")}
            </button>
          }
        >
          {localizeApiMessage(error.message)}
        </Alert>
      ) : null}

      {loading && !loan ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : loan ? (
        <div className="flex flex-col gap-4">
          {/* Status + transitions bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("loanDetail.statusLabel")}
              </span>
              <Badge tone={LOAN_STATUS_TONE[loan.status]}>
                {t(`loans.status.${loan.status}`)}
              </Badge>
            </div>
            <LoanStatusActions loan={loan} onActed={refetch} />
          </div>

          {/* Visa stepper */}
          <LoanVisaStepper loan={loan} onActed={refetch} />

          {/* Tabs */}
          <Tabs
            items={tabs}
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as TabId)}
            ariaLabel={t("loanDetail.tabsAriaLabel")}
          />

          {activeTab === "infos" ? (
            <TabsPanel id="infos">
              <LoanInfoTab
                loan={loan}
                client={client}
                products={products}
                sectors={sectors}
                subSectors={subSectors}
                creditAgentName={creditAgentName}
                canEdit={!!canEditInfos}
                onEdit={() => setDrawerOpen(true)}
              />
            </TabsPanel>
          ) : null}

          {activeTab === "financial" ? (
            <TabsPanel id="financial">
              <LoanFinancialTab
                loan={loan}
                canEdit={canUpdate || isPlatformAdmin}
                onUpdated={refetch}
              />
            </TabsPanel>
          ) : null}

          {activeTab === "schedule" ? (
            <TabsPanel id="schedule">
              <LoanScheduleTab
                loanPublicId={loan.public_id}
                status={loan.status}
                currency={loan.currency}
                canGenerate={canGenerateSchedule}
              />
            </TabsPanel>
          ) : null}
        </div>
      ) : null}

      {loan && canEditInfos ? (
        <LoanDrawer
          open={drawerOpen}
          mode="edit"
          initial={loan}
          onClose={() => setDrawerOpen(false)}
          onSubmit={handleEditSubmit}
        />
      ) : null}
    </>
  );
}
