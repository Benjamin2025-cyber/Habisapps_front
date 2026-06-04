"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { cn } from "@/lib/cn";
import type { ReopenAccountingDayPayload } from "@/lib/api/accounting-days";
import { localizeApiError } from "@/lib/api/errors";
import { useTranslations } from "@/lib/i18n/I18nProvider";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: ReopenAccountingDayPayload) => Promise<void>;
  businessDate: string | null;
};

const MIN_REASON_LENGTH = 10;

/**
 * Reopens a previously closed accounting day. The backend requires a
 * justification (min 10 chars) which is audited and only visible to users who
 * can reopen — so we enforce the same minimum client-side before submitting.
 */
export function ReopenDayDrawer({ open, onClose, onSubmit, businessDate }: Props) {
  const t = useTranslations();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const trimmed = reason.trim();
  const tooShort = trimmed.length < MIN_REASON_LENGTH;

  function reset() {
    setReason("");
    setError(null);
    setTouched(false);
  }

  function handleClose() {
    if (submitting) return;
    reset();
    onClose();
  }

  async function handleSubmit() {
    setTouched(true);
    if (tooShort) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ reason: trimmed });
      reset();
    } catch (cause) {
      setError(localizeApiError(cause).generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title={t("accountingDay.reopen.title")}
      description={
        businessDate
          ? t("accountingDay.reopen.description", { date: businessDate })
          : t("accountingDay.reopen.descriptionNoDate")
      }
      footer={
        <>
          <Button variant="ghost" size="md" onClick={handleClose} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? t("accountingDay.reopen.submitting") : t("accountingDay.reopen.submit")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Alert variant="warning" title={t("accountingDay.reopen.warningTitle")}>
          {t("accountingDay.reopen.warningBody")}
        </Alert>

        {error ? (
          <Alert variant="danger" title={t("accountingDay.reopen.errorTitle")}>
            {error}
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2">
          <label
            htmlFor="accounting-day-reopen-reason"
            className="text-sm font-medium text-foreground"
          >
            {t("accountingDay.reopen.reasonLabel")}
          </label>
          <textarea
            id="accounting-day-reopen-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            onBlur={() => setTouched(true)}
            rows={4}
            maxLength={2000}
            placeholder={t("accountingDay.reopen.reasonPlaceholder")}
            aria-invalid={touched && tooShort ? true : undefined}
            className={cn(
              "rounded-[var(--radius-field)] border bg-background px-4 py-3 text-base text-foreground",
              "placeholder:text-muted-foreground/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/10",
              touched && tooShort
                ? "border-danger focus-visible:ring-danger/20"
                : "border-input focus-visible:border-foreground/30",
            )}
          />
          {touched && tooShort ? (
            <p className="text-xs text-danger">
              {t("accountingDay.reopen.reasonError", { min: MIN_REASON_LENGTH })}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("accountingDay.reopen.reasonHint", { min: MIN_REASON_LENGTH })}
            </p>
          )}
        </div>
      </div>
    </Drawer>
  );
}
