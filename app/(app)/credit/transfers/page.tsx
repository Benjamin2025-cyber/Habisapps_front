"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SearchIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { fetchAgencies, type Agency } from "@/lib/api/agencies";
import { fetchLoans, type PaginatedLoans } from "@/lib/api/loans";
import { createLoanTransfer } from "@/lib/api/loan-transfers";
import { fetchStaffUsers, type StaffUser } from "@/lib/api/staff-users";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/SessionProvider";
import { usePermissionGuard } from "@/lib/auth/usePermissionGuard";
import { useApi } from "@/lib/hooks/useApi";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";
import { LOAN_STATUS_TONE } from "../loans/_components/status";

/** Loans in these statuses can't be transferred (API rule). */
const NON_TRANSFERABLE = new Set(["rejected", "closed", "written_off"]);

/**
 * Roles that actually manage loan portfolios (hold loans.create/update). The
 * API enforces no role on a loan's gestionnaire — only active + same agency —
 * so we narrow the picker to these roles client-side.
 */
const MANAGER_ROLES = ["loan-officer", "agency-manager"];

type TransferResult = {
  loanNumber: string;
  ok: boolean;
  message?: string;
};

/**
 * P13 — Crédit › Mutation de prêt. Flux (cf. PDF p18) : choisir l'**agence** →
 * gestionnaires et prêts se filtrent sur cette agence → choisir le gestionnaire
 * cible → cocher les prêts à muter → aperçu → confirmer (une mutation par prêt,
 * résultats détaillés).
 */
export default function LoanTransfersPage() {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const toast = useToast();
  const allowed = usePermissionGuard(["loans.transfers.manage"]);

  const token = session.status === "authenticated" ? session.token : null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedLoans> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchLoans(token, { perPage: 100 });
    },
    [token],
  );

  const { data, loading, error, refetch } = useApi(fetcher, [token]);

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([
      fetchStaffUsers(token, { perPage: 100 }).catch(() => null),
      fetchAgencies(token, { perPage: 100 }).catch(() => null),
    ]).then(([staffResponse, agenciesResponse]) => {
      if (cancelled) return;
      setStaff(staffResponse?.data ?? []);
      setAgencies(agenciesResponse?.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const [agencyId, setAgencyId] = useState("");
  const [targetManagerId, setTargetManagerId] = useState("");
  const [currentManagerId, setCurrentManagerId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [managerSearch, setManagerSearch] = useState("");
  // Client-side pagination of the (locally-filtered) loan list.
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(25);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [results, setResults] = useState<TransferResult[] | null>(null);

  const staffMap = useMemo(() => {
    const map = new Map<string, StaffUser>();
    for (const u of staff) map.set(u.public_id, u);
    return map;
  }, [staff]);

  const managerName = useCallback(
    (publicId: string | null): string =>
      publicId ? (staffMap.get(publicId)?.name ?? publicId) : "—",
    [staffMap],
  );

  const selectedAgency = agencyId
    ? (agencies.find((a) => a.public_id === agencyId) ?? null)
    : null;

  // Active loan managers (loan-officer / agency-manager) of the selected agency.
  // Plain derivation — the React Compiler memoizes it.
  const eligibleManagers = !agencyId
    ? []
    : staff.filter(
        (u) =>
          u.status === "active" &&
          u.agency_public_id === agencyId &&
          u.roles.some((role) => MANAGER_ROLES.includes(role)),
      );

  const targetManager = targetManagerId
    ? (staffMap.get(targetManagerId) ?? null)
    : null;

  const allLoans = data?.data ?? [];

  // Transferable loans of the selected agency, excluding any already managed
  // by the chosen target. Per-manager counts power the left gestionnaire list;
  // the current-manager selection narrows the table on the right.
  const agencyTransferable = !agencyId
    ? []
    : allLoans.filter(
        (loan) =>
          loan.agency_public_id === agencyId &&
          !NON_TRANSFERABLE.has(loan.status) &&
          !!loan.credit_agent_public_id &&
          (!targetManagerId ||
            loan.credit_agent_public_id !== targetManagerId),
      );

  const loanCountByManager = new Map<string, number>();
  for (const loan of agencyTransferable) {
    const key = loan.credit_agent_public_id;
    if (key) loanCountByManager.set(key, (loanCountByManager.get(key) ?? 0) + 1);
  }

  const visibleLoans = currentManagerId
    ? agencyTransferable.filter(
        (loan) => loan.credit_agent_public_id === currentManagerId,
      )
    : agencyTransferable;

  const selectedLoans = visibleLoans.filter((loan) =>
    selected.has(loan.public_id),
  );

  const totalMinor = selectedLoans.reduce(
    (sum, loan) =>
      sum + (loan.approved_principal_minor ?? loan.requested_amount_minor ?? 0),
    0,
  );

  // Client-side pagination over the filtered list (the loans index has no
  // agency filter, so the rows are filtered locally). safePage guards against
  // a stale page after filters shrink the result set.
  const lastPage = Math.max(1, Math.ceil(visibleLoans.length / tablePageSize));
  const safePage = Math.min(tablePage, lastPage);
  const pagedLoans = visibleLoans.slice(
    (safePage - 1) * tablePageSize,
    safePage * tablePageSize,
  );

  // Switching agency invalidates the manager choices and selection.
  function changeAgency(id: string) {
    setAgencyId(id);
    setTargetManagerId("");
    setCurrentManagerId("");
    setSelected(new Set());
    setResults(null);
    setTablePage(1);
    setManagerSearch("");
  }

  // Changing the target may exclude rows it already manages — reset selection.
  function changeTarget(id: string) {
    setTargetManagerId(id);
    setSelected(new Set());
    setResults(null);
    setTablePage(1);
  }

  function changeCurrentManager(id: string) {
    setCurrentManagerId(id);
    setTablePage(1);
  }

  function toggle(loanId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(loanId)) next.delete(loanId);
      else next.add(loanId);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => {
      const allVisibleSelected =
        visibleLoans.length > 0 &&
        visibleLoans.every((loan) => current.has(loan.public_id));
      if (allVisibleSelected) return new Set();
      return new Set(visibleLoans.map((loan) => loan.public_id));
    });
  }

  const canConfirm =
    !!agencyId &&
    !!targetManagerId &&
    reason.trim().length > 0 &&
    selectedLoans.length > 0 &&
    !submitting;

  async function handleConfirm() {
    if (!token || !canConfirm) return;
    setSubmitting(true);
    setResults(null);
    const outcomes: TransferResult[] = [];
    for (const loan of selectedLoans) {
      const label = loan.loan_number ?? loan.public_id;
      try {
        await createLoanTransfer(token, loan.public_id, {
          new_manager_public_id: targetManagerId,
          transfer_reason: reason.trim(),
          transfer_date: transferDate || undefined,
        });
        outcomes.push({ loanNumber: label, ok: true });
      } catch (cause) {
        const { generalMessage } = localizeApiError(cause);
        outcomes.push({ loanNumber: label, ok: false, message: generalMessage });
      }
    }
    setResults(outcomes);
    const okCount = outcomes.filter((o) => o.ok).length;
    const failCount = outcomes.length - okCount;
    if (failCount === 0) {
      toast.success(
        t("loanTransfers.toast.doneTitle"),
        t("loanTransfers.toast.doneBody", { count: okCount }),
      );
    } else {
      toast.error(
        t("loanTransfers.toast.partialTitle"),
        t("loanTransfers.toast.partialBody", { ok: okCount, fail: failCount }),
      );
    }
    setSelected(new Set());
    setReason("");
    setTransferDate("");
    setSubmitting(false);
    setConfirmOpen(false);
    refetch();
  }

  if (session.status !== "authenticated" || !allowed) return null;

  const agencyOptions = agencies.map((a) => ({
    value: a.public_id,
    label: a.code ? `${a.code} — ${a.name}` : a.name,
  }));
  const managerOptions = eligibleManagers.map((u) => ({
    value: u.public_id,
    label: u.name,
  }));
  // Left-list managers: the agency's eligible managers minus the target,
  // narrowed by the search box.
  const managerList = eligibleManagers.filter(
    (u) =>
      u.public_id !== targetManagerId &&
      (managerSearch.trim() === "" ||
        u.name.toLowerCase().includes(managerSearch.trim().toLowerCase())),
  );

  const allVisibleSelected =
    visibleLoans.length > 0 &&
    visibleLoans.every((loan) => selected.has(loan.public_id));

  const agencyLabel = selectedAgency
    ? selectedAgency.code
      ? `${selectedAgency.code} — ${selectedAgency.name}`
      : selectedAgency.name
    : "—";

  return (
    <>
      <PageHeader
        title={t("loanTransfers.pageTitle")}
        description={t("loanTransfers.pageDescription")}
      />

      {/* Agency → managers → reason */}
      <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-background p-4">
        <Select
          label={t("loanTransfers.fields.agency")}
          value={agencyId}
          options={agencyOptions}
          placeholder={t("loanTransfers.fields.agencyPlaceholder")}
          onChange={changeAgency}
          required
          hint={t("loanTransfers.fields.agencyHint")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label={t("loanTransfers.fields.targetManager")}
            value={targetManagerId}
            options={managerOptions}
            placeholder={t("loanTransfers.fields.targetManagerPlaceholder")}
            onChange={changeTarget}
            required
            disabled={!agencyId}
            hint={t("loanTransfers.fields.targetManagerHint")}
          />
          <TextField
            label={t("loanTransfers.fields.reason")}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            hint={t("loanTransfers.fields.reasonHint")}
          />
          <TextField
            label={t("loanTransfers.fields.transferDate")}
            type="date"
            value={transferDate}
            onChange={(event) => setTransferDate(event.target.value)}
            hint={t("loanTransfers.fields.transferDateHint")}
          />
        </div>
      </section>

      {error ? (
        <Alert
          variant="danger"
          title={t("loanTransfers.errorTitle")}
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

      {!agencyId ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          {t("loanTransfers.selectAgencyPrompt")}
        </div>
      ) : loading && !data ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          {/* LEFT — gestionnaires de l'agence (filtre le tableau de droite) */}
          <section className="flex h-fit flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
            <header className="border-b border-border px-4 py-2.5">
              <h3 className="text-sm font-semibold text-foreground">
                {t("loanTransfers.managers.title")}
              </h3>
            </header>
            <div className="border-b border-border p-3">
              <div className="flex h-10 items-center gap-2 rounded-[var(--radius-field)] border border-input bg-background px-3">
                <SearchIcon className="h-4 w-4 text-muted-foreground" />
                <input
                  type="search"
                  value={managerSearch}
                  onChange={(event) => setManagerSearch(event.target.value)}
                  placeholder={t("loanTransfers.managers.searchPlaceholder")}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
                />
              </div>
            </div>
            <div className="max-h-[28rem] overflow-y-auto">
              <button
                type="button"
                onClick={() => changeCurrentManager("")}
                className={`flex w-full items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5 text-left text-sm hover:bg-accent/5 ${
                  currentManagerId === ""
                    ? "bg-accent/10 font-semibold text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <span>{t("loanTransfers.managers.all")}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                  {agencyTransferable.length}
                </span>
              </button>
              {managerList.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                  {t("loanTransfers.managers.empty")}
                </p>
              ) : (
                managerList.map((manager) => (
                  <button
                    key={manager.public_id}
                    type="button"
                    onClick={() => changeCurrentManager(manager.public_id)}
                    className={`flex w-full items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5 text-left text-sm last:border-0 hover:bg-accent/5 ${
                      currentManagerId === manager.public_id
                        ? "bg-accent/10 font-semibold"
                        : ""
                    }`}
                  >
                    <span className="truncate text-foreground">
                      {manager.name}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                      {loanCountByManager.get(manager.public_id) ?? 0}
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>

          {/* RIGHT — prêts mutables */}
          <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
          <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h3 className="text-sm font-semibold text-foreground">
              {t("loanTransfers.list.title", { agency: agencyLabel })}
            </h3>
            <span className="text-xs text-muted-foreground">
              {t("loanTransfers.list.count", { count: visibleLoans.length })}
            </span>
          </header>

          {visibleLoans.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {t("loanTransfers.list.empty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAll}
                        aria-label={t("loanTransfers.list.selectAll")}
                        className="h-4 w-4 rounded border-input text-accent focus:ring-2 focus:ring-ring/20"
                      />
                    </th>
                    <th className="px-3 py-2">
                      {t("loanTransfers.columns.number")}
                    </th>
                    <th className="px-3 py-2">
                      {t("loanTransfers.columns.currentManager")}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {t("loanTransfers.columns.amount")}
                    </th>
                    <th className="px-3 py-2">
                      {t("loanTransfers.columns.status")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedLoans.map((loan) => {
                    const isSelected = selected.has(loan.public_id);
                    return (
                      <tr
                        key={loan.public_id}
                        className={`border-b border-border/60 last:border-0 ${
                          isSelected ? "bg-accent/5" : ""
                        }`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggle(loan.public_id)}
                            aria-label={loan.loan_number ?? loan.public_id}
                            className="h-4 w-4 rounded border-input text-accent focus:ring-2 focus:ring-ring/20"
                          />
                        </td>
                        <td className="px-3 py-2 font-bold tabular-nums text-foreground">
                          {loan.loan_number ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {managerName(loan.credit_agent_public_id)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-foreground">
                          {format.currencyMinor(
                            loan.approved_principal_minor ??
                              loan.requested_amount_minor ??
                              0,
                            { currency: loan.currency ?? "XAF" },
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge tone={LOAN_STATUS_TONE[loan.status]}>
                            {t(`loans.status.${loan.status}`)}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {visibleLoans.length > 0 ? (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-2.5 text-xs">
              <label className="flex items-center gap-1.5 text-muted-foreground">
                {t("dataTable.perPage")}
                <select
                  value={tablePageSize}
                  onChange={(event) => {
                    setTablePageSize(Number(event.target.value));
                    setTablePage(1);
                  }}
                  aria-label={t("dataTable.perPage")}
                  className="h-8 rounded-[var(--radius-field)] border border-border bg-background px-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {[10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <span className="tabular-nums text-muted-foreground">
                {t("dataTable.range", {
                  from:
                    visibleLoans.length === 0
                      ? 0
                      : (safePage - 1) * tablePageSize + 1,
                  to: Math.min(safePage * tablePageSize, visibleLoans.length),
                  total: visibleLoans.length,
                })}
              </span>
              {lastPage > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setTablePage(Math.max(1, safePage - 1))}
                    disabled={safePage <= 1}
                    className="inline-flex h-8 items-center rounded-[var(--radius-field)] border border-border bg-background px-3 font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("common.previous")}
                  </button>
                  <span className="tabular-nums text-muted-foreground">
                    {t("dataTable.pageOf", {
                      current: safePage,
                      total: lastPage,
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setTablePage(Math.min(lastPage, safePage + 1))
                    }
                    disabled={safePage >= lastPage}
                    className="inline-flex h-8 items-center rounded-[var(--radius-field)] border border-border bg-background px-3 font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("common.next")}
                  </button>
                </>
              ) : null}
            </footer>
          ) : null}
          </section>
        </div>
      )}

      {/* Preview + confirm */}
      {agencyId && selectedLoans.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-accent/30 bg-accent/5 p-4">
          <p className="text-sm text-foreground">
            {targetManager
              ? t("loanTransfers.preview", {
                  count: selectedLoans.length,
                  total: format.currencyMinor(totalMinor, { currency: "XAF" }),
                  manager: targetManager.name,
                })
              : t("loanTransfers.previewNoTarget", {
                  count: selectedLoans.length,
                  total: format.currencyMinor(totalMinor, { currency: "XAF" }),
                })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => setConfirmOpen(true)}
              disabled={!canConfirm}
            >
              {t("loanTransfers.actions.confirm")}
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={() => setSelected(new Set())}
              disabled={submitting}
            >
              {t("loanTransfers.actions.clear")}
            </Button>
          </div>
          {!targetManagerId ? (
            <p className="text-xs text-danger">
              {t("loanTransfers.needTarget")}
            </p>
          ) : reason.trim().length === 0 ? (
            <p className="text-xs text-danger">
              {t("loanTransfers.reasonRequired")}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Results */}
      {results ? (
        <section className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-background p-4">
          <h3 className="text-sm font-semibold text-foreground">
            {t("loanTransfers.results.title")}
          </h3>
          <ul className="flex flex-col gap-1 text-sm">
            {results.map((result, index) => (
              <li
                key={`${result.loanNumber}-${index}`}
                className="flex items-start gap-2"
              >
                <Badge tone={result.ok ? "success" : "danger"}>
                  {result.ok
                    ? t("loanTransfers.results.ok")
                    : t("loanTransfers.results.failed")}
                </Badge>
                <span className="font-mono text-xs tabular-nums text-foreground">
                  {result.loanNumber}
                </span>
                {result.message ? (
                  <span className="text-xs text-muted-foreground">
                    — {result.message}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title={t("loanTransfers.confirmDialog.title")}
        description={t("loanTransfers.confirmDialog.description", {
          count: selectedLoans.length,
          manager: targetManager?.name ?? "—",
        })}
        confirmLabel={t("loanTransfers.actions.confirm")}
        cancelLabel={t("common.cancel")}
        busyLabel={t("common.loading")}
        loading={submitting}
        onConfirm={handleConfirm}
        onClose={() => setConfirmOpen(false)}
      >
        <div className="rounded-[var(--radius-field)] border border-border bg-muted/30 px-3 py-2">
          <dl className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">
                {t("loanTransfers.confirmDialog.loans")}
              </dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {selectedLoans.length}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">
                {t("loanTransfers.confirmDialog.total")}
              </dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {format.currencyMinor(totalMinor, { currency: "XAF" })}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">
                {t("loanTransfers.confirmDialog.target")}
              </dt>
              <dd className="font-semibold text-foreground">
                {targetManager?.name ?? "—"}
              </dd>
            </div>
          </dl>
        </div>
      </ConfirmDialog>
    </>
  );
}
