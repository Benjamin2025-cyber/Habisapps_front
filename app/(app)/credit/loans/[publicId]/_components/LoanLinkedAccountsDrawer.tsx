"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import {
  fetchCustomerAccounts,
  type CustomerAccount,
} from "@/lib/api/customer-accounts";
import { localizeApiError } from "@/lib/api/errors";
import {
  updateLoanLinkedAccounts,
  type Loan,
  type LoanLinkedAccountsPayload,
} from "@/lib/api/loans";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";

type Props = {
  open: boolean;
  loan: Loan;
  onClose: () => void;
  onSaved: () => void;
};

type AccountField =
  | "amortization_account_public_id"
  | "unpaid_account_public_id"
  | "recovery_account_public_id"
  | "transfer_account_public_id";

const FIELDS: AccountField[] = [
  "amortization_account_public_id",
  "unpaid_account_public_id",
  "recovery_account_public_id",
  "transfer_account_public_id",
];

const FIELD_LABEL: Record<AccountField, string> = {
  amortization_account_public_id: "loans.fields.amortizationAccount",
  unpaid_account_public_id: "loans.fields.unpaidAccount",
  recovery_account_public_id: "loans.fields.recoveryAccount",
  transfer_account_public_id: "loans.fields.transferAccount",
};

/**
 * Edit a loan's linked accounts after the draft stage (back-issue #22 —
 * `PATCH /loans/{id}/linked-accounts`). Only sends the fields the user actually
 * changed; the backend rejects an empty/no-op payload, so the Save button stays
 * disabled until something differs.
 */
export function LoanLinkedAccountsDrawer({ open, loan, onClose, onSaved }: Props) {
  const t = useTranslations();
  const toast = useToast();
  const session = useSession();
  const token = session.status === "authenticated" ? session.token : null;

  const initial = useMemo<Record<AccountField, string>>(
    () => ({
      amortization_account_public_id: loan.amortization_account_public_id ?? "",
      unpaid_account_public_id: loan.unpaid_account_public_id ?? "",
      recovery_account_public_id: loan.recovery_account_public_id ?? "",
      transfer_account_public_id: loan.transfer_account_public_id ?? "",
    }),
    [loan],
  );

  const [form, setForm] = useState<Record<AccountField, string>>(initial);
  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(initial);
    setErrors({});
    setGeneralError(null);
  }, [open, initial]);

  // The linked account must belong to the loan's client (and agency).
  useEffect(() => {
    if (!open || !token || !loan.client_public_id) {
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
  }, [open, token, loan.client_public_id]);

  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        value: a.public_id,
        label: `${a.account_number ?? a.public_id}${a.status ? ` (${a.status})` : ""}`,
      })),
    [accounts],
  );

  // Only the fields that actually changed go in the payload.
  const changed = FIELDS.filter((field) => form[field] !== initial[field]);
  const hasChanges = changed.length > 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !hasChanges) return;
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);

    const payload: LoanLinkedAccountsPayload = {};
    for (const field of changed) {
      payload[field] = form[field] === "" ? null : form[field];
    }

    try {
      const { changed_fields } = await updateLoanLinkedAccounts(
        token,
        loan.public_id,
        payload,
      );
      toast.success(
        t("loanDetail.linkedAccounts.toast.savedTitle"),
        t("loanDetail.linkedAccounts.toast.savedBody", {
          count: changed_fields.length || changed.length,
        }),
      );
      onSaved();
      onClose();
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        amortization_account_public_id: t("loans.fields.amortizationAccount"),
        unpaid_account_public_id: t("loans.fields.unpaidAccount"),
        recovery_account_public_id: t("loans.fields.recoveryAccount"),
        transfer_account_public_id: t("loans.fields.transferAccount"),
        accounts: t("loanDetail.linkedAccounts.title"),
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
      title={t("loanDetail.linkedAccounts.title")}
      description={t("loanDetail.linkedAccounts.hint")}
      widthClassName="sm:w-[32rem]"
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
            form="loan-linked-accounts-form"
            disabled={submitting || !hasChanges}
          >
            {submitting ? t("common.loading") : t("common.save")}
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
        id="loan-linked-accounts-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        {accountOptions.length === 0 ? (
          <p className="rounded-[var(--radius-field)] border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
            {t("loanDetail.linkedAccounts.noAccounts")}
          </p>
        ) : null}
        {FIELDS.map((field) => (
          <Select
            key={field}
            label={t(FIELD_LABEL[field])}
            value={form[field]}
            options={accountOptions}
            placeholder={t("loanDetail.linkedAccounts.placeholder")}
            isClearable
            onChange={(next) => setForm((c) => ({ ...c, [field]: next }))}
            error={errors[field]}
          />
        ))}
      </form>
    </Drawer>
  );
}
