"use client";

import { useEffect, useState } from "react";
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
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { DenominationCounter } from "../../../_components/DenominationCounter";

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

  const [closing, setClosing] = useState("");
  const [denomCounts, setDenomCounts] = useState<DenominationCount[]>([]);
  const [denomTotal, setDenomTotal] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setClosing("");
    setDenomCounts([]);
    setDenomTotal(0);
    setErrors({});
    setGeneralError(null);
  }, [open]);

  const currency = session?.currency ?? "XAF";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
            disabled={submitting}
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
