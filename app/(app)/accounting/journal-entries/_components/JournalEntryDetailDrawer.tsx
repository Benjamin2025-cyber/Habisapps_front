"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { MoneyField } from "@/components/ui/MoneyField";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import {
  addJournalLine,
  approveJournalEntry,
  deleteJournalLine,
  entryTotals,
  getJournalEntry,
  postJournalEntry,
  rejectJournalEntry,
  reverseJournalEntry,
  submitJournalEntry,
  type JournalEntry,
} from "@/lib/api/journal-entries";
import {
  fetchLedgerAccounts,
  type LedgerAccount,
} from "@/lib/api/ledger-accounts";
import { useSession } from "@/lib/auth/SessionProvider";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { JOURNAL_STATUS_TONE } from "./status";

type Props = {
  open: boolean;
  entryPublicId: string | null;
  /** Current user's public_id — used to enforce the maker-checker rule in the UI. */
  currentUserPublicId: string | null;
  canManageLines: boolean;
  canReview: boolean;
  canPost: boolean;
  canReverse: boolean;
  onClose: () => void;
  /** Notify the parent list to refresh after any mutation. */
  onChanged: () => void;
};

type Side = "debit" | "credit";

const CURRENCY = "XAF";

export function JournalEntryDetailDrawer({
  open,
  entryPublicId,
  currentUserPublicId,
  canManageLines,
  canReview,
  canPost,
  canReverse,
  onClose,
  onChanged,
}: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);

  // Add-line form
  const [laId, setLaId] = useState("");
  const [side, setSide] = useState<Side>("debit");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Reject + confirm
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState<"post" | "reverse" | null>(null);

  const load = useCallback(async () => {
    if (!open || !token || !entryPublicId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getJournalEntry(token, entryPublicId);
      setEntry(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "error");
      setEntry(null);
    } finally {
      setLoading(false);
    }
  }, [open, token, entryPublicId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) {
      setShowReject(false);
      setReason("");
      setLaId("");
      setAmount("");
      setMemo("");
      setSide("debit");
      setAddError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    fetchLedgerAccounts(token, { perPage: 100 })
      .then((res) => {
        if (!cancelled) setLedgerAccounts(res.data);
      })
      .catch(() => {
        if (!cancelled) setLedgerAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  const accountLabel = useMemo(() => {
    const byId = new Map<string, string>();
    for (const a of ledgerAccounts) byId.set(a.public_id, `${a.code} — ${a.name}`);
    return (id: string | null) => (id ? (byId.get(id) ?? id) : "—");
  }, [ledgerAccounts]);

  // Only active accounts within the entry's agency scope can receive lines.
  const accountOptions = useMemo(() => {
    if (!entry) return [];
    return ledgerAccounts
      .filter(
        (a) =>
          a.status === "active" &&
          (a.agency_public_id === null ||
            a.agency_public_id === entry.agency_public_id),
      )
      .map((a) => ({ value: a.public_id, label: `${a.code} — ${a.name}` }));
  }, [ledgerAccounts, entry]);

  const totals = entry ? entryTotals(entry) : { debit: 0, credit: 0, balanced: false };
  const currency = entry?.lines[0]?.currency ?? CURRENCY;
  const isDraft = entry?.status === "draft";
  const isSubmitted = entry?.status === "submitted";
  const isApproved = entry?.status === "approved";
  const isPosted = entry?.status === "posted";
  // Maker-checker: the submitter/creator cannot approve or reject their own entry.
  const isMaker =
    entry?.submitted_by_user_public_id != null &&
    entry.submitted_by_user_public_id === currentUserPublicId;

  function money(minor: number): string {
    return format.currencyMinor(minor, { currency });
  }

  async function handleAddLine() {
    if (!token || !entry) return;
    setAddError(null);
    const major = Number(amount.trim());
    if (!laId || !Number.isFinite(major) || major <= 0) {
      setAddError(t("journalEntries.detail.addLineInvalid"));
      return;
    }
    const minor = Math.round(major * 100);
    setBusy("add");
    try {
      await addJournalLine(token, {
        journal_entry_public_id: entry.public_id,
        ledger_account_public_id: laId,
        debit_minor: side === "debit" ? minor : 0,
        credit_minor: side === "credit" ? minor : 0,
        currency: CURRENCY,
        line_memo: memo.trim() || null,
      });
      setAmount("");
      setMemo("");
      await load();
      onChanged();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause, {
        ledger_account_public_id: t("journalEntries.detail.lineAccount"),
        debit_minor: t("journalEntries.detail.amount"),
        credit_minor: t("journalEntries.detail.amount"),
      });
      setAddError(generalMessage);
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteLine(linePublicId: string) {
    if (!token) return;
    setBusy(`del-${linePublicId}`);
    try {
      await deleteJournalLine(token, linePublicId);
      await load();
      onChanged();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("journalEntries.toast.errorTitle"), generalMessage);
    } finally {
      setBusy(null);
    }
  }

  async function runAction(
    kind: "submit" | "approve" | "post" | "reverse" | "reject",
  ) {
    if (!token || !entry) return;
    setBusy(kind);
    try {
      if (kind === "submit") await submitJournalEntry(token, entry.public_id);
      else if (kind === "approve") await approveJournalEntry(token, entry.public_id);
      else if (kind === "post") await postJournalEntry(token, entry.public_id);
      else if (kind === "reverse") await reverseJournalEntry(token, entry.public_id);
      else if (kind === "reject")
        await rejectJournalEntry(token, entry.public_id, reason.trim());
      toast.success(
        t("journalEntries.toast.actionDoneTitle"),
        t(`journalEntries.toast.action.${kind}`),
      );
      setShowReject(false);
      setReason("");
      setConfirm(null);
      await load();
      onChanged();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("journalEntries.toast.errorTitle"), generalMessage);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("journalEntries.detail.title", {
        reference: entry?.reference ?? "",
      })}
      description={entry?.description ?? t("journalEntries.detail.noDescription")}
      widthClassName="sm:w-[52rem]"
      footer={
        <Button variant="ghost" size="md" type="button" onClick={onClose}>
          {t("common.close")}
        </Button>
      }
    >
      {loading && !entry ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </p>
      ) : error ? (
        <p className="rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
          {localizeApiMessage(error)}
        </p>
      ) : entry ? (
        <div className="flex flex-col gap-5">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-field)] border border-border bg-muted/30 px-3 py-2.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {entry.business_date}
              </span>
              <span className="font-bold tabular-nums text-foreground">
                {entry.reference}
              </span>
            </div>
            <Badge tone={JOURNAL_STATUS_TONE[entry.status]}>
              {t(`journalEntries.status.${entry.status}`)}
            </Badge>
          </div>

          {entry.status === "rejected" && entry.rejection_reason ? (
            <div className="rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
              <span className="font-semibold">
                {t("journalEntries.detail.rejectionReason")}:{" "}
              </span>
              {entry.rejection_reason}
            </div>
          ) : null}

          {/* Lines */}
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">
                    {t("journalEntries.detail.lineAccount")}
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    {t("journalEntries.detail.memo")}
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    {t("journalEntries.detail.debit")}
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    {t("journalEntries.detail.credit")}
                  </th>
                  {isDraft && canManageLines ? <th className="w-10" /> : null}
                </tr>
              </thead>
              <tbody>
                {entry.lines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isDraft && canManageLines ? 5 : 4}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      {t("journalEntries.detail.noLines")}
                    </td>
                  </tr>
                ) : (
                  entry.lines.map((line) => (
                    <tr
                      key={line.public_id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-3 py-2 text-foreground">
                        {accountLabel(line.ledger_account_public_id)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {line.line_memo ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground">
                        {line.debit_minor ? money(line.debit_minor) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground">
                        {line.credit_minor ? money(line.credit_minor) : "—"}
                      </td>
                      {isDraft && canManageLines ? (
                        <td className="px-2 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteLine(line.public_id)}
                            disabled={busy === `del-${line.public_id}`}
                            className="text-xs font-semibold text-danger hover:underline disabled:opacity-50"
                          >
                            {t("common.delete")}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/20 text-sm font-semibold">
                  <td className="px-3 py-2 text-muted-foreground" colSpan={2}>
                    {t("journalEntries.detail.totals")}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">
                    {money(totals.debit)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">
                    {money(totals.credit)}
                  </td>
                  {isDraft && canManageLines ? <td /> : null}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Balance indicator */}
          <div
            className={`rounded-[var(--radius-field)] px-3 py-2 text-xs font-semibold ${
              totals.balanced
                ? "border border-success/30 bg-success/10 text-success"
                : "border border-warning/30 bg-warning/10 text-warning"
            }`}
          >
            {totals.balanced
              ? t("journalEntries.detail.balanced")
              : t("journalEntries.detail.unbalanced", {
                  diff: money(Math.abs(totals.debit - totals.credit)),
                })}
          </div>

          {/* Add-line form (draft only) */}
          {isDraft && canManageLines ? (
            <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-dashed border-border p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("journalEntries.detail.addLine")}
              </h4>
              {addError ? (
                <p className="rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {addError}
                </p>
              ) : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Select
                  label={t("journalEntries.detail.lineAccount")}
                  value={laId}
                  options={accountOptions}
                  placeholder={t("journalEntries.detail.lineAccountPlaceholder")}
                  onChange={setLaId}
                  hint={
                    accountOptions.length === 0
                      ? t("journalEntries.detail.noAccounts")
                      : undefined
                  }
                />
                <Select
                  label={t("journalEntries.detail.side")}
                  value={side}
                  options={[
                    { value: "debit", label: t("journalEntries.detail.debit") },
                    { value: "credit", label: t("journalEntries.detail.credit") },
                  ]}
                  onChange={(next) => setSide(next as Side)}
                />
                <MoneyField
                  label={t("journalEntries.detail.amount")}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  hint={t("journalEntries.detail.amountHint")}
                />
                <TextField
                  label={t("journalEntries.detail.memo")}
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                />
              </div>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={handleAddLine}
                  disabled={busy === "add"}
                >
                  {busy === "add"
                    ? t("common.loading")
                    : t("journalEntries.detail.addLineConfirm")}
                </Button>
              </div>
            </div>
          ) : null}

          {/* Reject reason form */}
          {showReject ? (
            <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-danger/30 p-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("journalEntries.detail.rejectReasonLabel")}
              </label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                maxLength={2000}
                className="rounded-[var(--radius-field)] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setShowReject(false)}
                  disabled={busy === "reject"}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  type="button"
                  onClick={() => runAction("reject")}
                  disabled={busy === "reject" || reason.trim().length === 0}
                >
                  {busy === "reject"
                    ? t("common.loading")
                    : t("journalEntries.actions.reject")}
                </Button>
              </div>
            </div>
          ) : null}

          {/* Lifecycle actions */}
          <div className="flex flex-wrap gap-2">
            {isDraft ? (
              <Button
                variant="primary"
                size="md"
                type="button"
                onClick={() => runAction("submit")}
                disabled={busy !== null || !totals.balanced || entry.lines.length < 2}
              >
                {busy === "submit"
                  ? t("common.loading")
                  : t("journalEntries.actions.submit")}
              </Button>
            ) : null}
            {isSubmitted && canReview && !isMaker ? (
              <Button
                variant="primary"
                size="md"
                type="button"
                onClick={() => runAction("approve")}
                disabled={busy !== null}
              >
                {busy === "approve"
                  ? t("common.loading")
                  : t("journalEntries.actions.approve")}
              </Button>
            ) : null}
            {isApproved && canPost ? (
              <Button
                variant="primary"
                size="md"
                type="button"
                onClick={() => setConfirm("post")}
                disabled={busy !== null}
              >
                {t("journalEntries.actions.post")}
              </Button>
            ) : null}
            {isSubmitted && canReview && !isMaker ? (
              <Button
                variant="danger"
                size="md"
                type="button"
                onClick={() => setShowReject(true)}
                disabled={busy !== null}
              >
                {t("journalEntries.actions.reject")}
              </Button>
            ) : null}
            {isSubmitted && canReview && isMaker ? (
              <p className="w-full text-xs text-muted-foreground">
                {t("journalEntries.detail.makerCheckerHint")}
              </p>
            ) : null}
            {isPosted && canReverse ? (
              <Button
                variant="danger"
                size="md"
                type="button"
                onClick={() => setConfirm("reverse")}
                disabled={busy !== null}
              >
                {t("journalEntries.actions.reverse")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm === "reverse"
            ? t("journalEntries.confirm.reverseTitle")
            : t("journalEntries.confirm.postTitle")
        }
        description={
          confirm === "reverse"
            ? t("journalEntries.confirm.reverseBody")
            : t("journalEntries.confirm.postBody")
        }
        confirmLabel={
          confirm === "reverse"
            ? t("journalEntries.actions.reverse")
            : t("journalEntries.actions.post")
        }
        cancelLabel={t("common.cancel")}
        tone={confirm === "reverse" ? "danger" : "primary"}
        loading={busy === confirm}
        busyLabel={t("common.loading")}
        onConfirm={() => confirm && runAction(confirm)}
        onClose={() => (busy ? undefined : setConfirm(null))}
      />
    </Drawer>
  );
}
