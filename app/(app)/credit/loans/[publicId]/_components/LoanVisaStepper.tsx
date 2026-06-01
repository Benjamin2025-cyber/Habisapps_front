"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import {
  APPROVAL_STEPS,
  decideLoanApproval,
  fetchLoanApprovals,
  type ApprovalDecision,
  type ApprovalStep,
  type Loan,
  type LoanApprovalResult,
} from "@/lib/api/loans";
import { localizeApiError } from "@/lib/api/errors";
import { cn } from "@/lib/cn";
import { useCan, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";

type Props = {
  loan: Loan;
  /** Refetch the loan after a decision (status may have advanced). */
  onActed: () => void;
};

/** Statuses where the visa circuit is still in progress / actionable. */
const IN_PROGRESS = new Set(["application", "in_review"]);
/** Statuses that imply the visa circuit already cleared. */
const CLEARED = new Set([
  "approved",
  "disbursed",
  "active",
  "rescheduled",
  "closed",
  "written_off",
]);

type StepVisual = "approved" | "pending" | "rejected" | "idle";

export function LoanVisaStepper({ loan, onActed }: Props) {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();
  const token = session.status === "authenticated" ? session.token : null;

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const canMontage = useCan("loans.approvals.montage");
  const canComptabilite = useCan("loans.approvals.comptabilite");
  const canControle = useCan("loans.approvals.controle");
  const canDirection = useCan("loans.approvals.direction");
  const canStep: Record<ApprovalStep, boolean> = {
    montage: isPlatformAdmin || canMontage,
    comptabilite: isPlatformAdmin || canComptabilite,
    controle: isPlatformAdmin || canControle,
    direction: isPlatformAdmin || canDirection,
  };

  // Real visa history, hydrated from GET /loans/{id}/approvals (back-issue #15).
  // Keyed by step; the last approval wins so a "returned → approved" sequence
  // shows the latest decision. Re-hydrates whenever the loan refreshes.
  const [results, setResults] = useState<
    Partial<Record<ApprovalStep, LoanApprovalResult>>
  >({});

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchLoanApprovals(token, loan.public_id)
      .then((list) => {
        if (cancelled) return;
        const byStep: Partial<Record<ApprovalStep, LoanApprovalResult>> = {};
        for (const approval of list) byStep[approval.step] = approval;
        setResults(byStep);
      })
      .catch(() => {
        /* leave status-derived visuals as the fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [token, loan.public_id, loan.updated_at]);
  const [pending, setPending] = useState<{
    step: ApprovalStep;
    decision: ApprovalDecision;
  } | null>(null);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const inProgress = IN_PROGRESS.has(loan.status);
  const cleared = CLEARED.has(loan.status);
  const rejected = loan.status === "rejected";

  function visualFor(step: ApprovalStep): StepVisual {
    const result = results[step];
    if (result) {
      if (result.decision === "approved") return "approved";
      if (result.decision === "rejected") return "rejected";
      return "pending"; // returned → back to pending
    }
    if (cleared) return "approved";
    if (rejected) return "rejected";
    return inProgress ? "pending" : "idle";
  }

  function openDecision(step: ApprovalStep, decision: ApprovalDecision) {
    setPending({ step, decision });
    setComments("");
  }

  async function confirmDecision() {
    if (!token || !pending) return;
    setSubmitting(true);
    try {
      const { approval } = await decideLoanApproval(
        token,
        loan.public_id,
        pending.step,
        { decision: pending.decision, comments: comments.trim() || null },
      );
      setResults((current) => ({ ...current, [pending.step]: approval }));
      toast.success(
        t("loanDetail.visa.toast.doneTitle"),
        t("loanDetail.visa.toast.doneBody", {
          step: t(`loanDetail.visa.steps.${pending.step}`),
          decision: t(`loanDetail.visa.decision.${pending.decision}`),
        }),
      );
      setPending(null);
      onActed();
    } catch (cause) {
      const { generalMessage } = localizeApiError(cause);
      toast.error(t("loanDetail.visa.toast.errorTitle"), generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  const toneOf: Record<StepVisual, "success" | "warning" | "danger" | "neutral"> =
    {
      approved: "success",
      pending: "warning",
      rejected: "danger",
      idle: "neutral",
    };

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-background">
      <header className="flex items-center justify-between border-b border-border border-l-4 border-l-accent bg-accent/5 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">
          {t("loanDetail.visa.title")}
        </h3>
      </header>

      <div className="flex flex-col gap-1 p-4">
        <p className="mb-2 rounded-[var(--radius-field)] border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {t("loanDetail.visa.historyNote")}
        </p>

        <ol className="flex flex-col">
          {APPROVAL_STEPS.map((step, index) => {
            const visual = visualFor(step);
            const result = results[step];
            const actionable = inProgress && canStep[step];
            const isLast = index === APPROVAL_STEPS.length - 1;

            return (
              <li key={step} className="flex gap-3">
                {/* Rail + node */}
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                      visual === "approved" &&
                        "border-success bg-success text-white",
                      visual === "rejected" &&
                        "border-danger bg-danger text-white",
                      visual === "pending" &&
                        "border-warning bg-warning/15 text-warning",
                      visual === "idle" &&
                        "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {visual === "approved" ? "✓" : index + 1}
                  </span>
                  {!isLast ? (
                    <span className="my-1 w-px flex-1 bg-border" />
                  ) : null}
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col gap-1.5 pb-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {t(`loanDetail.visa.steps.${step}`)}
                    </span>
                    <Badge tone={toneOf[visual]}>
                      {t(`loanDetail.visa.state.${visual}`)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(`loanDetail.visa.stepHint.${step}`)}
                  </p>

                  {result ? (
                    <p className="text-xs text-muted-foreground">
                      {t("loanDetail.visa.actedLine", {
                        decision: t(
                          `loanDetail.visa.decision.${result.decision}`,
                        ),
                        at: result.acted_at?.slice(0, 16).replace("T", " ") ?? "",
                      })}
                      {result.comments ? ` — ${result.comments}` : ""}
                    </p>
                  ) : null}

                  {actionable ? (
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openDecision(step, "approved")}
                      >
                        {t("loanDetail.visa.actions.approve")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDecision(step, "returned")}
                      >
                        {t("loanDetail.visa.actions.return")}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => openDecision(step, "rejected")}
                      >
                        {t("loanDetail.visa.actions.reject")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <Drawer
        open={pending !== null}
        onClose={submitting ? () => undefined : () => setPending(null)}
        title={
          pending
            ? t("loanDetail.visa.drawer.title", {
                step: t(`loanDetail.visa.steps.${pending.step}`),
                decision: t(`loanDetail.visa.decision.${pending.decision}`),
              })
            : ""
        }
        description={t("loanDetail.visa.drawer.hint")}
        widthClassName="sm:w-[28rem]"
        footer={
          <>
            <Button
              variant="ghost"
              size="md"
              type="button"
              onClick={() => setPending(null)}
              disabled={submitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              size="md"
              type="button"
              onClick={confirmDecision}
              disabled={submitting}
            >
              {submitting ? t("common.loading") : t("loanDetail.visa.drawer.confirm")}
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("loanDetail.visa.drawer.commentsLabel")}
          </span>
          <textarea
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            rows={4}
            maxLength={1000}
            placeholder={t("loanDetail.visa.drawer.commentsPlaceholder")}
            className="rounded-[var(--radius-field)] border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </label>
      </Drawer>
    </section>
  );
}
