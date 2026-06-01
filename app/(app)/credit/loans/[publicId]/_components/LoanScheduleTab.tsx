"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  fetchLoanSchedule,
  generateLoanSchedule,
  type LoanScheduleSnapshot,
  type LoanStatus,
} from "@/lib/api/loans";
import { localizeApiError } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/SessionProvider";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";

type Props = {
  loanPublicId: string;
  status: LoanStatus;
  currency: string | null;
  canGenerate: boolean;
};

/** Statuses for which the API accepts schedule generation. */
const GENERATABLE: LoanStatus[] = ["approved", "rescheduled"];

export function LoanScheduleTab({
  loanPublicId,
  status,
  currency,
  canGenerate,
}: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const toast = useToast();
  const token = session.status === "authenticated" ? session.token : null;

  const [snapshot, setSnapshot] = useState<LoanScheduleSnapshot | null>(null);
  const [generating, setGenerating] = useState(false);

  // Hydrate the active schedule from GET /loans/{id}/schedule (back-issue #15):
  // the table now survives a refresh instead of needing regeneration.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchLoanSchedule(token, loanPublicId)
      .then((result) => {
        if (!cancelled && result) setSnapshot(result);
      })
      .catch(() => {
        /* no active schedule yet — fall through to the empty state */
      });
    return () => {
      cancelled = true;
    };
  }, [token, loanPublicId]);

  const ccy = currency ?? "XAF";
  const eligible = GENERATABLE.includes(status);
  const money = (minor: number) => format.currencyMinor(minor, { currency: ccy });

  async function handleGenerate() {
    if (!token) return;
    setGenerating(true);
    try {
      const result = await generateLoanSchedule(token, loanPublicId);
      setSnapshot(result);
      toast.success(
        t("loanDetail.schedule.generatedTitle"),
        t("loanDetail.schedule.generatedBody", {
          count: result.lines.length,
        }),
      );
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("loanDetail.schedule.errorTitle"), generalMessage);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-foreground">
            {t("loanDetail.schedule.title")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {eligible
              ? t("loanDetail.schedule.subtitle")
              : t("loanDetail.schedule.notEligible")}
          </p>
        </div>
        {canGenerate ? (
          <Button
            variant="primary"
            size="md"
            onClick={handleGenerate}
            disabled={generating || !eligible}
          >
            {generating
              ? t("common.loading")
              : snapshot
                ? t("loanDetail.schedule.regenerate")
                : t("loanDetail.schedule.generate")}
          </Button>
        ) : null}
      </div>

      <p className="rounded-[var(--radius-field)] border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {t("loanDetail.schedule.persistenceNote")}
      </p>

      {snapshot ? (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-background">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-right">
                  {t("loanDetail.schedule.columns.number")}
                </th>
                <th className="px-3 py-2">
                  {t("loanDetail.schedule.columns.dueDate")}
                </th>
                <th className="px-3 py-2 text-right">
                  {t("loanDetail.schedule.columns.principal")}
                </th>
                <th className="px-3 py-2 text-right">
                  {t("loanDetail.schedule.columns.interest")}
                </th>
                <th className="px-3 py-2 text-right">
                  {t("loanDetail.schedule.columns.fees")}
                </th>
                <th className="px-3 py-2 text-right">
                  {t("loanDetail.schedule.columns.insurance")}
                </th>
                <th className="px-3 py-2 text-right">
                  {t("loanDetail.schedule.columns.tax")}
                </th>
                <th className="px-3 py-2 text-right">
                  {t("loanDetail.schedule.columns.total")}
                </th>
                <th className="px-3 py-2 text-right">
                  {t("loanDetail.schedule.columns.remaining")}
                </th>
              </tr>
            </thead>
            <tbody>
              {snapshot.lines.map((line) => (
                <tr
                  key={line.installment_number}
                  className="border-b border-border/60 last:border-0 tabular-nums"
                >
                  <td className="px-3 py-2 text-right font-semibold text-foreground">
                    {line.installment_number}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {line.due_date?.slice(0, 10) ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground">
                    {money(line.principal_minor)}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {money(line.interest_minor)}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {money(line.fees_minor)}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {money(line.insurance_minor)}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {money(line.tax_minor)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-foreground">
                    {money(line.total_installment_minor)}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {money(line.remaining_principal_minor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-background p-10 text-center text-sm text-muted-foreground">
          {eligible
            ? t("loanDetail.schedule.empty")
            : t("loanDetail.schedule.emptyNotEligible")}
        </div>
      )}
    </div>
  );
}
