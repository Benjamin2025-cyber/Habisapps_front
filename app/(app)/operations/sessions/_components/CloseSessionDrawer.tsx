"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/ui/TextField";
import { MoneyField } from "@/components/ui/MoneyField";
import { localizeApiError } from "@/lib/api/errors";
import type {
  CloseTellerSessionPayload,
  DenominationCount,
  TellerSession,
} from "@/lib/api/teller-sessions";
import { fetchTellerTransactions } from "@/lib/api/teller-transactions";
import { fetchSessionReconciliations } from "@/lib/api/till-reconciliations";
import { useSession } from "@/lib/auth/SessionProvider";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { DenominationCounter } from "../../../_components/DenominationCounter";

/**
 * Pre-close controls mirroring the accounting-day close blockers that a closed
 * session would otherwise trigger (`CloseControlService`): pending teller
 * transactions, and the absence of a balanced zero-difference reconciliation.
 * Blocking here is deliberate — once the day moves to `closing`, the write lock
 * forbids recording the arrêté that would clear the blocker.
 */
type CloseGuard = {
  pendingCount: number;
  hasBalancedReconciliation: boolean;
};

type Props = {
  open: boolean;
  session: TellerSession | null;
  /** Whether the session's till requires a denomination count at close. */
  requiresDenominations?: boolean;
  onClose: () => void;
  onSubmit: (payload: CloseTellerSessionPayload) => Promise<void>;
};

export function CloseSessionDrawer({
  open,
  session,
  requiresDenominations,
  onClose,
  onSubmit,
}: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const auth = useSession();
  const token = auth.status === "authenticated" ? auth.token : null;

  const [closing, setClosing] = useState("");
  const [denomCounts, setDenomCounts] = useState<DenominationCount[]>([]);
  const [denomTotal, setDenomTotal] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [guard, setGuard] = useState<CloseGuard | null>(null);
  const [checking, setChecking] = useState(false);
  const [guardUnavailable, setGuardUnavailable] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClosing("");
    setDenomCounts([]);
    setDenomTotal(0);
    setErrors({});
    setGeneralError(null);
  }, [open]);

  const sessionId = session?.public_id ?? null;

  useEffect(() => {
    if (!open || !sessionId || !token) return;
    let cancelled = false;
    setChecking(true);
    setGuard(null);
    setGuardUnavailable(false);

    Promise.all([
      fetchTellerTransactions(token, {
        tellerSessionPublicId: sessionId,
        status: "pending_review",
        perPage: 1,
      }),
      fetchSessionReconciliations(token, sessionId),
    ])
      .then(([transactions, reconciliations]) => {
        if (cancelled) return;
        setGuard({
          pendingCount: transactions.meta.pagination.total,
          hasBalancedReconciliation: reconciliations.some(
            (item) => item.status === "balanced" && item.difference_minor === 0,
          ),
        });
      })
      .catch(() => {
        // Fail open: the guard is a UX safety net, not an authorisation check.
        // A flaky read must not strand a teller with an uncloseable till.
        if (!cancelled) setGuardUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, sessionId, token]);

  const currency = session?.currency ?? "XAF";
  const blockers = guard
    ? [
        ...(guard.pendingCount > 0 ? (["pending"] as const) : []),
        ...(guard.hasBalancedReconciliation ? [] : (["reconciliation"] as const)),
      ]
    : [];
  const blocked = blockers.length > 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (blocked || checking) return;
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);

    const manualMinor = Math.round(Number(closing.trim() || "0") * 100);
    try {
      await onSubmit({
        closing_declaration_minor: requiresDenominations
          ? denomTotal
          : Number.isFinite(manualMinor)
            ? manualMinor
            : 0,
        currency,
        denomination_counts: requiresDenominations ? denomCounts : undefined,
      });
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        closing_declaration_minor: t("sessions.fields.closing"),
      });
      setErrors(fieldErrors);
      setGeneralError(generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={t("sessions.closeDrawer.title")}
      description={t("sessions.closeDrawer.hint")}
      widthClassName="sm:w-[28rem]"
      footer={
        <>
          <Button
            variant="ghost"
            size="md"
            type="button"
            onClick={onClose}
            disabled={submitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            form="close-session-form"
            disabled={submitting || checking || blocked}
          >
            {submitting ? t("common.loading") : t("sessions.closeDrawer.confirm")}
          </Button>
        </>
      }
    >
      {generalError ? (
        <p className="mb-4 rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
          {generalError}
        </p>
      ) : null}

      {checking ? (
        <p className="mb-4 text-xs text-muted-foreground">
          {t("sessions.closeGuard.checking")}
        </p>
      ) : null}

      {guardUnavailable ? (
        <Alert
          variant="warning"
          title={t("sessions.closeGuard.unavailableTitle")}
          className="mb-4"
        >
          <p className="text-xs">{t("sessions.closeGuard.unavailableBody")}</p>
        </Alert>
      ) : null}

      {blocked && session ? (
        <Alert
          variant="danger"
          title={t("sessions.closeGuard.title")}
          className="mb-4"
        >
          <p className="text-xs">{t("sessions.closeGuard.intro")}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {blockers.includes("pending") ? (
              <li className="text-xs">
                <span className="font-medium">
                  {t("sessions.closeGuard.pendingTitle")}
                </span>{" "}
                {t("sessions.closeGuard.pendingBody", {
                  count: String(guard?.pendingCount ?? 0),
                })}{" "}
                <Link
                  href="/operations/transactions"
                  className="font-medium underline underline-offset-2"
                >
                  {t("sessions.closeGuard.pendingAction")}
                </Link>
              </li>
            ) : null}
            {blockers.includes("reconciliation") ? (
              <li className="text-xs">
                <span className="font-medium">
                  {t("sessions.closeGuard.reconciliationTitle")}
                </span>{" "}
                {t("sessions.closeGuard.reconciliationBody")}{" "}
                <Link
                  href={`/operations/inspection?session=${session.public_id}`}
                  className="font-medium underline underline-offset-2"
                >
                  {t("sessions.closeGuard.reconciliationAction")}
                </Link>
              </li>
            ) : null}
          </ul>
        </Alert>
      ) : null}

      <form
        id="close-session-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        {session ? (
          <div className="rounded-[var(--radius-field)] border border-border bg-muted/30 px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("sessions.closeDrawer.openingLabel")}
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {session.opening_declaration_minor !== null &&
                session.opening_declaration_minor !== undefined
                  ? format.currencyMinor(session.opening_declaration_minor, {
                      currency,
                    })
                  : "—"}
              </span>
            </div>
          </div>
        ) : null}
        {requiresDenominations ? (
          <DenominationCounter
            currency={currency}
            onChange={(lines, total) => {
              setDenomCounts(lines);
              setDenomTotal(total);
            }}
          />
        ) : (
          <MoneyField
            label={t("sessions.fields.closing")}
            value={closing}
            onChange={(event) => setClosing(event.target.value)}
            error={errors.closing_declaration_minor}
            required
            hint={t("sessions.fields.closingHint")}
          />
        )}
      </form>
    </Drawer>
  );
}
