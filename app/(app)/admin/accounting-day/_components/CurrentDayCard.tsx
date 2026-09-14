"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import type { AccountingDay } from "@/lib/api/accounting-days";
import {
  ACCOUNTING_DAY_STATUS_TONES,
  accountingDayStatusKey,
} from "./status";

export type DayAction = "start-close" | "close" | "cancel-close" | "reopen";

type Props = {
  day: AccountingDay | null;
  loading: boolean;
  canOpen: boolean;
  canClose: boolean;
  canReopen: boolean;
  /** The lifecycle action currently in flight, to disable buttons. */
  busyAction: DayAction | "open" | null;
  /** Open teller sessions blocking a clean close (null = N/A / unknown). */
  openSessionsCount: number | null;
  onOpen: () => void;
  onStartClose: () => void;
  onClose: () => void;
  onCancelClose: () => void;
  onReopen: () => void;
};

/**
 * Hero card summarising the active (or latest) accounting day and exposing the
 * lifecycle actions valid for its current status. When no day exists the card
 * surfaces the consultation-only state and an "open a day" call to action.
 */
export function CurrentDayCard({
  day,
  loading,
  canOpen,
  canClose,
  canReopen,
  busyAction,
  openSessionsCount,
  onOpen,
  onStartClose,
  onClose,
  onCancelClose,
  onReopen,
}: Props) {
  const t = useTranslations();
  const format = useFormatter();

  if (loading && !day) {
    return (
      <section className="rounded-[var(--radius-card)] border border-border bg-background p-6">
        <div className="h-5 w-40 animate-pulse rounded bg-muted/60" />
        <div className="mt-4 h-8 w-64 animate-pulse rounded bg-muted/60" />
      </section>
    );
  }

  // No day configured for the scope → consultation-only.
  if (!day) {
    return (
      <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-warning/30 bg-warning/5 p-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Badge tone="warning">{t("accountingDay.current.noneBadge")}</Badge>
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {t("accountingDay.current.noneTitle")}
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            {t("accountingDay.current.noneBody")}
          </p>
        </div>
        {canOpen ? (
          <div>
            <Button variant="primary" size="md" onClick={onOpen} disabled={busyAction !== null}>
              {t("accountingDay.actions.open")}
            </Button>
          </div>
        ) : null}
      </section>
    );
  }

  const tone = ACCOUNTING_DAY_STATUS_TONES[day.status];
  const registrable = day.can_register;
  const isClosing = day.status === "closing";
  const isClosed = day.status === "closed";
  const blockers = extractBlockers(day.close_summary);
  const closeControls = extractCloseControls(day.close_summary);
  const failedControls = closeControls.filter((control) => !control.passed);
  // Refuse start-close while teller sessions are still open. The backend now
  // rejects this safely (422 `open_teller_sessions`, no day-status change — D1
  // fixed via the start-close preflight), but we still block the attempt up
  // front so the admin gets a clear reason instead of a server error.
  const blockedByOpenSessions = registrable && (openSessionsCount ?? 0) > 0;

  return (
    <section className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-border bg-background p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={tone}>{t(accountingDayStatusKey(day.status))}</Badge>
            <Badge tone={registrable ? "success" : "neutral"}>
              {registrable
                ? t("accountingDay.current.registrationOpen")
                : t("accountingDay.current.registrationLocked")}
            </Badge>
            {day.is_holiday ? (
              <Badge tone="info">
                {day.holiday_name ?? t("accountingDay.current.holiday")}
              </Badge>
            ) : null}
          </div>
          <h2 className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
            {day.business_date ? format.date(day.business_date) : "—"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(`accountingDay.scope.${day.scope}`)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(day.status === "open" || day.status === "reopened") && canClose ? (
            <Button
              variant="outline"
              size="md"
              onClick={onStartClose}
              disabled={busyAction !== null || blockedByOpenSessions}
              title={
                blockedByOpenSessions
                  ? t("accountingDay.current.openSessionsBlock")
                  : undefined
              }
            >
              {busyAction === "start-close"
                ? t("accountingDay.actions.startClosing")
                : t("accountingDay.actions.startClose")}
            </Button>
          ) : null}

          {isClosing && canClose ? (
            <Button
              variant="outline"
              size="md"
              onClick={onCancelClose}
              disabled={busyAction !== null}
            >
              {busyAction === "cancel-close"
                ? t("accountingDay.actions.cancelClosing")
                : t("accountingDay.actions.cancelClose")}
            </Button>
          ) : null}

          {isClosing && canClose ? (
            <Button
              variant="primary"
              size="md"
              onClick={onClose}
              disabled={busyAction !== null}
            >
              {busyAction === "close"
                ? t("accountingDay.actions.closing")
                : t("accountingDay.actions.close")}
            </Button>
          ) : null}

          {isClosed && canReopen ? (
            <Button
              variant="outline"
              size="md"
              onClick={onReopen}
              disabled={busyAction !== null}
            >
              {t("accountingDay.actions.reopen")}
            </Button>
          ) : null}

          {isClosed && canOpen ? (
            <Button
              variant="primary"
              size="md"
              onClick={onOpen}
              disabled={busyAction !== null}
            >
              {t("accountingDay.actions.openNext")}
            </Button>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 border-t border-border pt-4 sm:grid-cols-2">
        <Field label={t("accountingDay.fields.openedAt")}>
          {day.calendar_opened_at ? format.dateTime(day.calendar_opened_at) : "—"}
        </Field>
        <Field label={t("accountingDay.fields.closedAt")}>
          {day.calendar_closed_at ? format.dateTime(day.calendar_closed_at) : "—"}
        </Field>
      </dl>

      {blockedByOpenSessions ? (
        <div className="rounded-[var(--radius-field)] border border-warning/30 bg-warning/5 p-4 text-sm">
          <p className="font-semibold text-warning">
            {t("accountingDay.current.openSessionsTitle", {
              count: openSessionsCount ?? 0,
            })}
          </p>
          <p className="mt-1 text-foreground/80">
            {t("accountingDay.current.openSessionsBody")}
          </p>
          <Link
            href="/operations/sessions"
            className="mt-2 inline-block text-xs font-semibold text-accent hover:underline"
          >
            {t("accountingDay.current.openSessionsLink")}
          </Link>
        </div>
      ) : null}

      {isClosing ? (
        <div className="rounded-[var(--radius-field)] border border-warning/30 bg-warning/5 p-4 text-sm">
          <p className="font-semibold text-warning">
            {t("accountingDay.current.closingTitle")}
          </p>
          <p className="mt-1 text-foreground/80">
            {closeControls.length === 0
              ? t("accountingDay.current.closingBody")
              : failedControls.length === 0
                ? t("accountingDay.current.controlsPassed", {
                    count: String(closeControls.length),
                  })
                : t("accountingDay.current.controlsFailed", {
                    count: String(failedControls.length),
                  })}
          </p>

          {/* The outcomes themselves, so finalising or cancelling is a decision
              made on this screen rather than by trying it. */}
          {closeControls.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {closeControls.map((control) => (
                <li key={control.code} className="flex flex-wrap items-baseline gap-2">
                  <Badge tone={control.passed ? "success" : "danger"}>
                    {control.passed
                      ? t("accountingDay.current.controlOk")
                      : t("accountingDay.current.controlKo")}
                  </Badge>
                  <span className="font-medium text-foreground">{control.code}</span>
                  {control.message ? (
                    <span className="text-foreground/70">{control.message}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {canClose ? (
            <p className="mt-1 text-foreground/80">
              {t("accountingDay.current.closingRecovery")}
            </p>
          ) : null}
          {day.close_failure_reason ? (
            <p className="mt-2 text-foreground/80">{day.close_failure_reason}</p>
          ) : null}
          {blockers.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/80">
              {blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm tabular-nums text-foreground">{children}</dd>
    </div>
  );
}

/**
 * Best-effort extraction of human-readable blocker labels from the close
 * summary payload, whose shape is owned by the backend (readiness->toArray()).
 */
type CloseControl = {
  code: string;
  status: string;
  message: string | null;
  passed: boolean;
};

/**
 * Per-control outcomes from `close_summary.close_control_batches`.
 *
 * start-close runs the controls synchronously and stores the result, so by the
 * time this card renders they have already finished. Not showing them left the
 * operator told to "finalise once the controls have succeeded" with no way to know
 * whether they had — the only route was to click Clôturer and find out.
 */
function extractCloseControls(
  summary: Record<string, unknown> | null,
): CloseControl[] {
  if (!summary) return [];
  const raw = summary.close_control_batches;
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const code = row.procedure_code;
    if (typeof code !== "string") return [];
    const status = typeof row.status === "string" ? row.status : "unknown";
    // A run that failed carries `failure_reason`; only the "no procedure
    // configured" case carries `message`. Reading just one of them left a real
    // failure showing its status and nothing about why, which is the one thing
    // the operator needs in order to act.
    const reason =
      typeof row.failure_reason === "string" && row.failure_reason !== ""
        ? row.failure_reason
        : typeof row.message === "string" && row.message !== ""
          ? row.message
          : null;

    return [
      {
        code,
        status,
        message: reason,
        // Anything that is not an explicit success is treated as not passed:
        // "missing_procedure" is a failure the operator has to act on.
        passed: status === "completed" || status === "succeeded",
      },
    ];
  });
}

function extractBlockers(summary: Record<string, unknown> | null): string[] {
  if (!summary) return [];
  const raw = summary.blockers;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object" && "control" in entry) {
        const control = (entry as { control?: unknown }).control;
        return typeof control === "string" ? control : null;
      }
      return null;
    })
    .filter((value): value is string => value !== null);
}
