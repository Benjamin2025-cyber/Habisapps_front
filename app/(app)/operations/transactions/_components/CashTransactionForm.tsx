"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { ClientPicker, type ClientOption } from "../../../_components/ClientPicker";
import {
  fetchAccountAvailableBalance,
  fetchCustomerAccounts,
  type AccountAvailableBalance,
  type CustomerAccount,
} from "@/lib/api/customer-accounts";
import {
  fetchAccountSignatures,
  type CustomerAccountSignature,
} from "@/lib/api/account-signatures";
import {
  storeCashDeposit,
  storeCashWithdrawal,
  type InitiatorType,
  type SignatureVerificationMethod,
  type TellerTransaction,
} from "@/lib/api/teller-transactions";
import type { TellerSession } from "@/lib/api/teller-sessions";
import { localizeApiError } from "@/lib/api/errors";
import { amountInWordsFr } from "@/lib/format/amountInWords";
import { useSession } from "@/lib/auth/SessionProvider";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";

type Direction = "deposit" | "withdrawal";

type Props = {
  direction: Direction;
  session: TellerSession;
  onDone: (tx: TellerTransaction, direction: Direction) => void;
};

const INITIATOR_TYPES: InitiatorType[] = [
  "holder",
  "proxy",
  "staff_on_behalf",
  "system",
];

const VERIFICATION_METHODS: SignatureVerificationMethod[] = [
  "visual_match",
  "thumbprint_match",
  "verified_proxy_mandate",
  "exception_override",
];

export function CashTransactionForm({ direction, session, onDone }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const sessionState = useSession();
  const token = sessionState.status === "authenticated" ? sessionState.token : null;
  const isWithdrawal = direction === "withdrawal";
  const currency = session.currency ?? "XAF";

  const [client, setClient] = useState<ClientOption | null>(null);
  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [depositorName, setDepositorName] = useState("");
  const [depositorAddress, setDepositorAddress] = useState("");
  const [initiatorType, setInitiatorType] = useState<InitiatorType>("holder");
  const [signatures, setSignatures] = useState<CustomerAccountSignature[]>([]);
  const [signatureId, setSignatureId] = useState("");
  const [method, setMethod] = useState<SignatureVerificationMethod>("visual_match");
  const [available, setAvailable] = useState<AccountAvailableBalance | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Load the selected client's accounts (scoped to the session agency).
  useEffect(() => {
    if (!token || !client) {
      setAccounts([]);
      setAccountId("");
      return;
    }
    let cancelled = false;
    fetchCustomerAccounts(token, {
      clientPublicId: client.value,
      status: "active",
      perPage: 100,
    })
      .then((res) => {
        if (cancelled) return;
        setAccounts(
          res.data.filter((a) => a.agency_public_id === session.agency_public_id),
        );
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, client, session.agency_public_id]);

  // Whenever an account is selected: load its available balance (both flows for
  // the info card) and, for withdrawals, its active signatures.
  useEffect(() => {
    if (!token || !accountId) {
      setSignatures([]);
      setSignatureId("");
      setAvailable(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      fetchAccountAvailableBalance(token, accountId, { currency }).catch(() => null),
      isWithdrawal
        ? fetchAccountSignatures(token, accountId, { perPage: 50 }).catch(() => [])
        : Promise.resolve<CustomerAccountSignature[]>([]),
    ]).then(([bal, sigs]) => {
      if (cancelled) return;
      setAvailable(bal);
      setSignatures(sigs.filter((s) => s.status === "active"));
    });
    return () => {
      cancelled = true;
    };
  }, [token, accountId, isWithdrawal, currency]);

  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        value: a.public_id,
        label: `${a.account_number}${a.account_type ? ` · ${a.account_type}` : ""}`,
      })),
    [accounts],
  );

  const selectedAccount = accounts.find((a) => a.public_id === accountId) ?? null;
  const holderName = client?.label ?? selectedAccount?.account_title ?? "—";

  const amountMinor = useMemo(() => {
    const v = Number(amount.trim());
    return Number.isFinite(v) ? Math.round(v * 100) : 0;
  }, [amount]);

  const amountWords = amountMinor > 0 ? amountInWordsFr(amountMinor, currency) : "";
  const overAvailable =
    isWithdrawal &&
    available !== null &&
    amountMinor > available.available_balance_minor;

  const canSubmit =
    !!accountId &&
    amountMinor > 0 &&
    (!isWithdrawal || !!signatureId) &&
    !submitting;

  function resetAfterDone() {
    setAmount("");
    setDescription("");
    setDepositorName("");
    setDepositorAddress("");
    setSignatureId("");
  }

  async function doSubmit() {
    if (!token) return;
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);
    try {
      let tx: TellerTransaction;
      if (isWithdrawal) {
        tx = await storeCashWithdrawal(token, session.public_id, {
          customer_account_public_id: accountId,
          amount_minor: amountMinor,
          currency,
          initiator_type: initiatorType,
          signature_public_id: signatureId,
          signature_verification_method: method,
          description: description.trim() || null,
        });
      } else {
        tx = await storeCashDeposit(token, session.public_id, {
          customer_account_public_id: accountId,
          amount_minor: amountMinor,
          currency,
          initiator_type: initiatorType,
          depositor_name: depositorName.trim() || null,
          depositor_address: depositorAddress.trim() || null,
          description: description.trim() || null,
        });
      }
      setConfirmOpen(false);
      onDone(tx, direction);
      resetAfterDone();
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        customer_account_public_id: t("cashTx.fields.account"),
        amount_minor: t("cashTx.fields.amount", { currency }),
        signature_public_id: t("cashTx.fields.signature"),
        signature_verification_method: t("cashTx.fields.method"),
      });
      setErrors(fieldErrors);
      setGeneralError(generalMessage);
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_20rem]">
      {/* ---- Left: form ---- */}
      <div className="flex flex-col gap-5">
        {generalError ? (
          <p className="rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
            {generalError}
          </p>
        ) : null}

        {/* 1. Customer & account */}
        <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-background p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("cashTx.section.customer")}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ClientPicker
              label={t("cashTx.fields.client")}
              value={client}
              onChange={(opt) => {
                setClient(opt);
                setAccountId("");
              }}
              agencyPublicId={session.agency_public_id ?? undefined}
              placeholder={t("cashTx.fields.clientPlaceholder")}
            />
            <Select
              label={t("cashTx.fields.account")}
              value={accountId}
              options={accountOptions}
              placeholder={t("cashTx.fields.accountPlaceholder")}
              onChange={setAccountId}
              error={errors.customer_account_public_id}
              required
              disabled={!client}
              hint={
                client && accountOptions.length === 0
                  ? t("cashTx.fields.noAccounts")
                  : undefined
              }
            />
          </div>

          {selectedAccount ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-[var(--radius-field)] border border-border bg-muted/30 px-4 py-3 text-sm sm:grid-cols-4">
              <Field label={t("cashTx.account.holder")} value={holderName} />
              <Field
                label={t("cashTx.account.number")}
                value={selectedAccount.account_number}
                mono
              />
              <Field
                label={t("cashTx.account.type")}
                value={selectedAccount.account_type ?? "—"}
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                  {t("cashTx.account.status")}
                </span>
                <Badge
                  tone={selectedAccount.status === "active" ? "success" : "neutral"}
                >
                  {selectedAccount.status}
                </Badge>
              </div>
              <div className="col-span-2 flex flex-col gap-0.5 sm:col-span-4">
                <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                  {t("cashTx.account.available")}
                </span>
                <span className="text-base font-semibold tabular-nums text-foreground">
                  {available
                    ? format.currencyMinor(available.available_balance_minor, {
                        currency,
                      })
                    : "…"}
                </span>
              </div>
            </div>
          ) : null}
        </section>

        {/* 2. Transaction details */}
        <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-background p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("cashTx.section.details")}
          </h3>

          <TextField
            label={t("cashTx.fields.amount", { currency })}
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            error={errors.amount_minor}
            required
            hint={amountWords || t("cashTx.fields.amountHint")}
          />

          {/* Payment method — the cash endpoints only support espèces today. */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("cashTx.fields.method")}
            </span>
            <div className="flex items-center gap-2">
              <Badge tone="info">{t("cashTx.method_cash")}</Badge>
              <span className="text-xs text-muted-foreground">
                {t("cashTx.methodNote")}
              </span>
            </div>
          </div>

          <Select
            label={t("cashTx.fields.initiator")}
            value={initiatorType}
            options={INITIATOR_TYPES.map((v) => ({
              value: v,
              label: t(`cashTx.initiator.${v}`),
            }))}
            onChange={(next) => setInitiatorType(next as InitiatorType)}
          />

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("cashTx.fields.description")}
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              maxLength={2000}
              className="rounded-[var(--radius-field)] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </label>
        </section>

        {/* 3. Direction-specific */}
        <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-background p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isWithdrawal
              ? t("cashTx.section.withdrawalControls")
              : t("cashTx.section.depositInfo")}
          </h3>

          {isWithdrawal ? (
            <>
              {available && overAvailable ? (
                <div className="rounded-[var(--radius-field)] border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                  {t("cashTx.overAvailable")}
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select
                  label={t("cashTx.fields.signature")}
                  value={signatureId}
                  options={signatures.map((s) => ({
                    value: s.public_id,
                    label: `${s.signer_name ?? s.public_id} · ${t(`cashTx.signatureType.${s.signature_type}`)}`,
                  }))}
                  placeholder={t("cashTx.fields.signaturePlaceholder")}
                  onChange={setSignatureId}
                  error={errors.signature_public_id}
                  required
                  disabled={!accountId}
                  hint={
                    accountId && signatures.length === 0
                      ? t("cashTx.fields.noSignatures")
                      : undefined
                  }
                />
                <Select
                  label={t("cashTx.fields.method")}
                  value={method}
                  options={VERIFICATION_METHODS.map((v) => ({
                    value: v,
                    label: t(`cashTx.method.${v}`),
                  }))}
                  onChange={(next) => setMethod(next as SignatureVerificationMethod)}
                  error={errors.signature_verification_method}
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label={t("cashTx.fields.depositorName")}
                value={depositorName}
                onChange={(event) => setDepositorName(event.target.value)}
              />
              <TextField
                label={t("cashTx.fields.depositorAddress")}
                value={depositorAddress}
                onChange={(event) => setDepositorAddress(event.target.value)}
              />
            </div>
          )}
        </section>

        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="md"
            type="button"
            onClick={() => {
              setClient(null);
              setAccountId("");
              resetAfterDone();
              setErrors({});
              setGeneralError(null);
            }}
          >
            {t("cashTx.actions.clear")}
          </Button>
          <Button
            variant={isWithdrawal ? "danger" : "primary"}
            size="md"
            type="button"
            disabled={!canSubmit}
            onClick={() => setConfirmOpen(true)}
          >
            {t("cashTx.actions.preview")}
          </Button>
        </div>
      </div>

      {/* ---- Right: live summary + tips ---- */}
      <aside className="flex flex-col gap-4">
        <section className="rounded-[var(--radius-card)] border border-border bg-background p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            {t("cashTx.summary.title")}
          </h3>
          <dl className="flex flex-col gap-2 text-sm">
            <SummaryRow
              label={t("cashTx.summary.type")}
              value={
                <span
                  className={isWithdrawal ? "text-danger" : "text-success"}
                >
                  {t(`cashTx.direction.${direction}`)}
                </span>
              }
            />
            <SummaryRow
              label={t("cashTx.summary.account")}
              value={selectedAccount?.account_number ?? "—"}
            />
            <SummaryRow label={t("cashTx.summary.holder")} value={holderName} />
            <div className="my-1 border-t border-border" />
            <SummaryRow
              label={t("cashTx.summary.amount")}
              value={
                <span className="font-semibold tabular-nums text-foreground">
                  {amountMinor > 0
                    ? format.currencyMinor(amountMinor, { currency })
                    : "—"}
                </span>
              }
            />
          </dl>
          {amountWords ? (
            <p className="mt-2 text-xs italic text-muted-foreground">
              {amountWords}
            </p>
          ) : null}
          <p className="mt-3 text-[0.7rem] text-muted-foreground">
            {t("cashTx.summary.feesNote")}
          </p>
        </section>

        <section className="rounded-[var(--radius-card)] border border-accent/30 bg-accent/5 p-5">
          <h3 className="mb-2 text-sm font-semibold text-accent">
            {t("cashTx.tips.title")}
          </h3>
          <ul className="flex list-disc flex-col gap-1.5 pl-4 text-xs text-muted-foreground">
            <li>{t("cashTx.tips.t1")}</li>
            <li>{t("cashTx.tips.t2")}</li>
            <li>{t("cashTx.tips.t3")}</li>
          </ul>
        </section>
      </aside>

      <ConfirmDialog
        open={confirmOpen}
        title={t("cashTx.confirm.title")}
        description={t("cashTx.confirm.body")}
        confirmLabel={
          isWithdrawal
            ? t("cashTx.submit.withdrawal")
            : t("cashTx.submit.deposit")
        }
        cancelLabel={t("common.cancel")}
        tone={isWithdrawal ? "danger" : "primary"}
        loading={submitting}
        busyLabel={t("common.loading")}
        onConfirm={doSubmit}
        onClose={() => (submitting ? undefined : setConfirmOpen(false))}
      >
        <div className="flex flex-col gap-2 rounded-[var(--radius-field)] border border-border bg-muted/30 px-4 py-3 text-sm">
          <SummaryRow
            label={t("cashTx.summary.type")}
            value={t(`cashTx.direction.${direction}`)}
          />
          <SummaryRow
            label={t("cashTx.summary.holder")}
            value={holderName}
          />
          <SummaryRow
            label={t("cashTx.summary.account")}
            value={selectedAccount?.account_number ?? "—"}
          />
          <SummaryRow
            label={t("cashTx.summary.amount")}
            value={
              <span className="font-semibold tabular-nums">
                {format.currencyMinor(amountMinor, { currency })}
              </span>
            }
          />
          {amountWords ? (
            <p className="text-xs italic text-muted-foreground">{amountWords}</p>
          ) : null}
        </div>
      </ConfirmDialog>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={`text-foreground ${mono ? "font-semibold tabular-nums" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}
