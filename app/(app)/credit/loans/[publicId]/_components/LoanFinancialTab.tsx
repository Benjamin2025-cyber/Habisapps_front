"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import type { Loan } from "@/lib/api/loans";
import { Field, Grid, PlainField, Section } from "./display";
import { LoanLinkedAccountsDrawer } from "./LoanLinkedAccountsDrawer";

type Props = {
  loan: Loan;
  /** Whether the actor may edit linked accounts (loans.update). */
  canEdit?: boolean;
  /** Refetch the loan after a linked-accounts save. */
  onUpdated?: () => void;
};

/** Linked accounts can be edited everywhere except terminal states. */
const LINKED_ACCOUNTS_LOCKED = new Set(["closed", "rejected", "written_off"]);

export function LoanFinancialTab({ loan, canEdit, onUpdated }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const currency = loan.currency ?? "XAF";
  const [accountsDrawerOpen, setAccountsDrawerOpen] = useState(false);
  const canEditAccounts = !!canEdit && !LINKED_ACCOUNTS_LOCKED.has(loan.status);

  const money = (minor: number | null): string =>
    minor === null || minor === undefined
      ? "—"
      : format.currencyMinor(minor, { currency });

  return (
    <div className="flex flex-col gap-4">
      <Section title={t("loanDetail.sections.amounts")}>
        <Grid>
          <PlainField
            label={t("loans.fields.requestedAmount")}
            value={money(loan.requested_amount_minor)}
          />
          <PlainField
            label={t("loanDetail.fields.approvedPrincipal")}
            value={money(loan.approved_principal_minor)}
          />
          <PlainField label={t("loans.fields.currency")} value={currency} mono />
          <PlainField
            label={t("loans.fields.installments")}
            value={loan.number_of_installments}
            mono
          />
          <PlainField
            label={t("loans.fields.firstInstallment")}
            value={loan.first_installment_date}
            mono
          />
          <PlainField
            label={t("loans.fields.trancheDuration")}
            value={loan.tranche_duration}
            mono
          />
          <PlainField
            label={t("loans.fields.gracePeriod")}
            value={loan.grace_period_duration}
            mono
          />
          <PlainField
            label={t("loans.fields.totalDuration")}
            value={loan.total_loan_duration}
            mono
          />
        </Grid>
      </Section>

      <Section title={t("loanDetail.sections.outstanding")}>
        <p className="mb-3 text-xs text-muted-foreground">
          {t("loanDetail.outstandingHint")}
        </p>
        <Grid>
          <PlainField
            label={t("loanDetail.fields.outstandingPrincipal")}
            value={money(loan.outstanding_principal_minor)}
          />
          <PlainField
            label={t("loanDetail.fields.globalOutstanding")}
            value={money(loan.global_outstanding_amount_minor)}
          />
          <PlainField
            label={t("loanDetail.fields.totalUnpaid")}
            value={money(loan.total_unpaid_amount_minor)}
          />
          <PlainField
            label={t("loanDetail.fields.dueAmount")}
            value={money(loan.due_amount_minor)}
          />
          <PlainField
            label={t("loanDetail.fields.nextRepayment")}
            value={loan.next_repayment_date}
            mono
          />
          <PlainField
            label={t("loanDetail.fields.lastRepayment")}
            value={loan.last_repayment_date}
            mono
          />
        </Grid>
      </Section>

      <Section title={t("loanDetail.sections.fees")}>
        <p className="mb-3 text-xs text-muted-foreground">
          {t("loanDetail.feesHint")}
        </p>
        <Grid>
          <PlainField
            label={t("loanDetail.fields.dossierFees")}
            value={money(loan.dossier_fees_minor)}
          />
          <PlainField
            label={t("loanDetail.fields.dossierFeesTax")}
            value={money(loan.dossier_fees_tax_minor)}
          />
          <PlainField
            label={t("loanDetail.fields.guaranteeDeposit")}
            value={money(loan.guarantee_deposit_amount_minor)}
          />
          <PlainField
            label={t("loanDetail.fields.insurance")}
            value={money(loan.insurance_amount_minor)}
          />
        </Grid>
      </Section>

      <Section
        title={t("loanDetail.sections.accounts")}
        action={
          canEditAccounts ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAccountsDrawerOpen(true)}
            >
              {t("loanDetail.linkedAccounts.edit")}
            </Button>
          ) : undefined
        }
      >
        <Grid>
          <AccountField
            label={t("loans.fields.amortizationAccount")}
            publicId={loan.amortization_account_public_id}
          />
          <AccountField
            label={t("loans.fields.unpaidAccount")}
            publicId={loan.unpaid_account_public_id}
          />
          <AccountField
            label={t("loans.fields.recoveryAccount")}
            publicId={loan.recovery_account_public_id}
          />
          <AccountField
            label={t("loans.fields.transferAccount")}
            publicId={loan.transfer_account_public_id}
          />
        </Grid>
      </Section>

      {canEditAccounts ? (
        <LoanLinkedAccountsDrawer
          open={accountsDrawerOpen}
          loan={loan}
          onClose={() => setAccountsDrawerOpen(false)}
          onSaved={() => onUpdated?.()}
        />
      ) : null}
    </div>
  );
}

function AccountField({
  label,
  publicId,
}: {
  label: string;
  publicId: string | null;
}) {
  if (!publicId) {
    return <PlainField label={label} value={null} />;
  }
  return (
    <Field label={label}>
      <Link
        href={`/accounts/${publicId}`}
        className="font-mono text-xs text-accent hover:underline"
      >
        {publicId}
      </Link>
    </Field>
  );
}
