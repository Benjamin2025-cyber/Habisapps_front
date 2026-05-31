"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import {
  fetchCustomerAccounts,
  type CustomerAccount,
} from "@/lib/api/customer-accounts";
import {
  fetchTellerSessions,
  type TellerSession,
} from "@/lib/api/teller-sessions";
import { fetchTills, type Till } from "@/lib/api/tills";
import { localizeApiError } from "@/lib/api/errors";
import type {
  DisbursementChannel,
  Loan,
  LoanDisbursePayload,
} from "@/lib/api/loans";
import { useSession } from "@/lib/auth/SessionProvider";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";

type Props = {
  open: boolean;
  loan: Loan | null;
  onClose: () => void;
  onSubmit: (payload: LoanDisbursePayload) => Promise<void>;
};

export function DisburseDrawer({ open, loan, onClose, onSubmit }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const [channel, setChannel] = useState<DisbursementChannel>("transfer_account");
  const [transferAccountId, setTransferAccountId] = useState("");
  const [tellerSessionId, setTellerSessionId] = useState("");
  const [businessDate, setBusinessDate] = useState("");
  const [notes, setNotes] = useState("");
  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);
  const [sessions, setSessions] = useState<TellerSession[]>([]);
  const [tills, setTills] = useState<Till[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setChannel("transfer_account");
    setTransferAccountId(loan?.transfer_account_public_id ?? "");
    setTellerSessionId("");
    setBusinessDate("");
    setNotes("");
    setErrors({});
    setGeneralError(null);
  }, [open, loan]);

  // The transfer account must belong to the loan's client.
  useEffect(() => {
    if (!open || !token || !loan?.client_public_id) {
      setAccounts([]);
      return;
    }
    let cancelled = false;
    fetchCustomerAccounts(token, {
      clientPublicId: loan.client_public_id,
      perPage: 100,
    })
      .then((response) => {
        if (!cancelled) setAccounts(response.data);
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token, loan?.client_public_id]);

  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        value: a.public_id,
        label: `${a.account_number ?? a.public_id}${a.status ? ` (${a.status})` : ""}`,
      })),
    [accounts],
  );

  // Cash disbursement runs through an OPEN teller session of the loan's agency.
  useEffect(() => {
    if (!open || !token) {
      setSessions([]);
      setTills([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      fetchTellerSessions(token, { perPage: 100 }).catch(() => ({ data: [] })),
      fetchTills(token, { perPage: 100 }).catch(() => ({ data: [] })),
    ]).then(([s, tl]) => {
      if (cancelled) return;
      setSessions((s.data as TellerSession[]).filter((x) => x.status === "open"));
      setTills(tl.data as Till[]);
    });
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  const loanAgency = loan?.agency_public_id ?? null;
  const sessionOptions = sessions
    .filter((s) => !loanAgency || s.agency_public_id === loanAgency)
    .map((s) => {
      const till = tills.find((x) => x.public_id === s.till_public_id);
      const tillLabel = till
        ? `${till.code} — ${till.name}`
        : (s.till_public_id ?? "—");
      return {
        value: s.public_id,
        label: `${tillLabel}${s.business_date ? ` · ${s.business_date}` : ""}`,
      };
    });

  const amount =
    loan?.approved_principal_minor ?? loan?.requested_amount_minor ?? null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);

    const payload: LoanDisbursePayload = {
      disbursement_channel: channel,
      business_date: businessDate || null,
      notes: notes.trim() || null,
      transfer_account_public_id:
        channel === "transfer_account" ? transferAccountId || null : null,
      teller_session_public_id:
        channel === "cash" ? tellerSessionId || null : null,
    };

    try {
      await onSubmit(payload);
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        transfer_account_public_id: t("disbursement.fields.transferAccount"),
        teller_session_public_id: t("disbursement.fields.tellerSession"),
        business_date: t("disbursement.fields.businessDate"),
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
      title={t("disbursement.drawer.title", {
        number: loan?.loan_number ?? "",
      })}
      description={t("disbursement.drawer.hint")}
      widthClassName="sm:w-[34rem]"
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
            form="disburse-form"
            disabled={submitting}
          >
            {submitting ? t("common.loading") : t("disbursement.drawer.confirm")}
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
        id="disburse-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        <div className="rounded-[var(--radius-field)] border border-border bg-muted/30 px-3 py-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {t("disbursement.drawer.amount")}
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {amount !== null
                ? format.currencyMinor(amount, {
                    currency: loan?.currency ?? "XAF",
                  })
                : "—"}
            </span>
          </div>
        </div>

        <Select
          label={t("disbursement.fields.channel")}
          value={channel}
          options={[
            {
              value: "transfer_account",
              label: t("disbursement.channel.transfer_account"),
            },
            { value: "cash", label: t("disbursement.channel.cash") },
          ]}
          onChange={(next) => setChannel(next as DisbursementChannel)}
        />

        {channel === "transfer_account" ? (
          <Select
            label={t("disbursement.fields.transferAccount")}
            value={transferAccountId}
            options={accountOptions}
            placeholder={t("disbursement.fields.transferAccountPlaceholder")}
            onChange={setTransferAccountId}
            error={errors.transfer_account_public_id}
            required
            hint={
              accountOptions.length === 0
                ? t("disbursement.fields.noAccounts")
                : t("disbursement.fields.transferAccountHint")
            }
          />
        ) : (
          <Select
            label={t("disbursement.fields.tellerSession")}
            value={tellerSessionId}
            options={sessionOptions}
            placeholder={t("disbursement.fields.tellerSessionPlaceholder")}
            onChange={setTellerSessionId}
            error={errors.teller_session_public_id}
            required
            hint={
              sessionOptions.length === 0
                ? t("disbursement.fields.noOpenSessions")
                : t("disbursement.fields.tellerSessionHint")
            }
          />
        )}

        <TextField
          label={t("disbursement.fields.businessDate")}
          type="date"
          value={businessDate}
          onChange={(event) => setBusinessDate(event.target.value)}
          error={errors.business_date}
          hint={t("disbursement.fields.businessDateHint")}
        />

        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("disbursement.fields.notes")}
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            maxLength={1000}
            className="rounded-[var(--radius-field)] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </label>
      </form>
    </Drawer>
  );
}
