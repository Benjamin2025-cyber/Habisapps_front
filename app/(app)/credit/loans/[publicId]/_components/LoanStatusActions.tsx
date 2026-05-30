"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/ui/TextField";
import {
  ALLOWED_TRANSITIONS,
  transitionLoanStatus,
  type Loan,
  type LoanStatus,
} from "@/lib/api/loans";
import { localizeApiError } from "@/lib/api/errors";
import { useCan, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";

type Props = {
  loan: Loan;
  onActed: () => void;
};

/**
 * Status transition buttons (submit to review, reject, return…). Note that
 * `approved` is NOT reachable here — it comes from completing the visa circuit.
 * Disbursement has its own dedicated screen (P15).
 */
export function LoanStatusActions({ loan, onActed }: Props) {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();
  const token = session.status === "authenticated" ? session.token : null;

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const canTransitionPerm = useCan("loans.status.transition");
  const canTransition = isPlatformAdmin || canTransitionPerm;

  const [target, setTarget] = useState<LoanStatus | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const targets = ALLOWED_TRANSITIONS[loan.status] ?? [];
  if (!canTransition || targets.length === 0) return null;

  function open(next: LoanStatus) {
    setTarget(next);
    setReason("");
    setNotes("");
  }

  async function confirm() {
    if (!token || !target) return;
    setSubmitting(true);
    try {
      await transitionLoanStatus(token, loan.public_id, {
        to_status: target,
        reason: reason.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success(
        t("loanDetail.transition.toast.doneTitle"),
        t("loanDetail.transition.toast.doneBody", {
          status: t(`loans.status.${target}`),
        }),
      );
      setTarget(null);
      onActed();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("loanDetail.transition.toast.errorTitle"), generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {targets.map((next) => (
          <Button
            key={next}
            variant={next === "rejected" ? "danger" : "outline"}
            size="sm"
            onClick={() => open(next)}
          >
            {t(`loanDetail.transition.to.${next}`)}
          </Button>
        ))}
      </div>

      <Drawer
        open={target !== null}
        onClose={submitting ? () => undefined : () => setTarget(null)}
        title={
          target
            ? t("loanDetail.transition.drawer.title", {
                status: t(`loans.status.${target}`),
              })
            : ""
        }
        description={t("loanDetail.transition.drawer.hint")}
        widthClassName="sm:w-[28rem]"
        footer={
          <>
            <Button
              variant="ghost"
              size="md"
              type="button"
              onClick={() => setTarget(null)}
              disabled={submitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              size="md"
              type="button"
              onClick={confirm}
              disabled={submitting}
            >
              {submitting
                ? t("common.loading")
                : t("loanDetail.transition.drawer.confirm")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField
            label={t("loanDetail.transition.drawer.reasonLabel")}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            hint={t("loanDetail.transition.drawer.reasonHint")}
          />
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("loanDetail.transition.drawer.notesLabel")}
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={1000}
              className="rounded-[var(--radius-field)] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </label>
        </div>
      </Drawer>
    </>
  );
}
