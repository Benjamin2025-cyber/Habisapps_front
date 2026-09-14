"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  type TransactionEnvelope,
} from "@/lib/api/teller-transactions";
import type { TellerSession } from "@/lib/api/teller-sessions";
import { getTill } from "@/lib/api/tills";
import { localizeApiError } from "@/lib/api/errors";
import { amountInWords } from "@/lib/format/amountInWords";
import { printCashReceipt } from "@/lib/print/cashReceipt";
import {
  DenominationCounter,
  type DenominationLine,
} from "../../../_components/DenominationCounter";
import { useSession } from "@/lib/auth/SessionProvider";
import { useFormatter, useLocale, useTranslations } from "@/lib/i18n/I18nProvider";

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
  const { locale } = useLocale();
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
  // True when the balance endpoint refused/failed (e.g. teller lacks the
  // permission — back-issue A6). Lets us tell the user the over-withdraw guard
  // is inactive rather than silently showing a blank balance.
  const [balanceUnavailable, setBalanceUnavailable] = useState(false);
  // The till may require a denomination breakdown for cash; when it does, the
  // deposit/withdrawal payload must carry `denomination_counts` summing exactly
  // to the amount, else the backend rejects with "Denomination counts are
  // required for the cash component".
  const [requiresDenominations, setRequiresDenominations] = useState(false);
  const [denomLines, setDenomLines] = useState<DenominationLine[]>([]);
  const [denomTotalMinor, setDenomTotalMinor] = useState(0);
  // Bump to remount the counter (clearing its internal inputs) after a tx.
  const [denomResetKey, setDenomResetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  /**
   * The receipt of the last posted operation — the accounting team asked for a
   * standing APERÇU + IMPRIMER flow after every entry. Kept until the teller
   * starts a new operation.
   */
  const receiptRef = useRef<HTMLElement | null>(null);
  const [receipt, setReceipt] = useState<{
    tx: TellerTransaction;
    openingFeeMinor: number | null;
    currency: string;
    direction: Direction;
    accountNumber: string;
    holder: string;
    amountMinor: number;
    amountWords: string;
  } | null>(null);

  /*
   * The receipt renders under the whole form — client, amount, the fourteen
   * denomination rows — so on a laptop it appears some 2 000 px below the fold
   * and the teller, who has just been told the operation is posted, sees the
   * page sit perfectly still. Bring it into view when it appears.
   */
  useEffect(() => {
    if (!receipt) return;

    /*
     * Posting does three things at once: it shows the receipt, clears the form,
     * and remounts the fourteen-row denomination counter above it. Each of those
     * lands in its own commit and moves the receipt, so a single scroll on the
     * first one is undone by the next and the panel settles just under the fold
     * — which for the teller is indistinguishable from nothing having happened.
     *
     * So hold it: re-scroll while the receipt is out of view, for a second at
     * most, and stop as soon as it is where the teller can see it.
     */
    const deadline = Date.now() + 1500;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const keepInView = () => {
      const node = receiptRef.current;
      if (!node) return;
      const box = node.getBoundingClientRect();
      const visible = box.top >= 0 && box.bottom <= window.innerHeight;
      if (!visible) {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (!visible && Date.now() < deadline) {
        timer = setTimeout(keepInView, 150);
      }
    };

    timer = setTimeout(keepInView, 0);
    return () => clearTimeout(timer);
  }, [receipt]);

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

  // Does this session's till require a cash denomination breakdown?
  useEffect(() => {
    if (!token || !session.till_public_id) {
      setRequiresDenominations(false);
      return;
    }
    let cancelled = false;
    getTill(token, session.till_public_id)
      .then((till) => {
        if (!cancelled) setRequiresDenominations(till.requires_denominations === true);
      })
      .catch(() => {
        if (!cancelled) setRequiresDenominations(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, session.till_public_id]);

  // Whenever an account is selected: load its available balance (both flows for
  // the info card) and, for withdrawals, its active signatures.
  useEffect(() => {
    if (!token || !accountId) {
      setSignatures([]);
      setSignatureId("");
      setAvailable(null);
      setBalanceUnavailable(false);
      return;
    }
    let cancelled = false;
    setBalanceUnavailable(false);
    Promise.all([
      fetchAccountAvailableBalance(token, accountId, { currency })
        .then((b) => ({ ok: true as const, balance: b }))
        .catch(() => ({ ok: false as const, balance: null })),
      isWithdrawal
        ? fetchAccountSignatures(token, accountId, { perPage: 50 }).catch(() => [])
        : Promise.resolve<CustomerAccountSignature[]>([]),
    ]).then(([balResult, sigs]) => {
      if (cancelled) return;
      setAvailable(balResult.balance);
      setBalanceUnavailable(!balResult.ok);
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
  // Keep the preview and receipt's human name free of the client's reference;
  // the account number already identifies the account, and the reference is
  // not a substitute for the holder's name. ClientPicker keeps the plain name
  // separately from the searchable option label for this purpose.
  const holderName = client?.holderName ?? selectedAccount?.account_title ?? "—";

  /*
   * The « frais d'ouverture » this operation will sweep to 7611 if it is the
   * account's first. Announced in the aperçu rather than discovered on the
   * receipt: the deduction is automatic, so the only question is whether the
   * teller can tell the customer about it before confirming.
   */
  const pendingOpeningFeeMinor = selectedAccount?.pending_opening_fee_minor ?? 0;

  const amountMinor = useMemo(() => {
    const v = Number(amount.trim());
    return Number.isFinite(v) ? Math.round(v * 100) : 0;
  }, [amount]);

  const amountWords = amountMinor > 0 ? amountInWords(amountMinor, currency, locale) : "";
  const overAvailable =
    isWithdrawal &&
    available !== null &&
    amountMinor > available.available_balance_minor;

  // When the till requires a breakdown, the counted total must match the amount.
  const denomComplete =
    !requiresDenominations || (amountMinor > 0 && denomTotalMinor === amountMinor);

  const canSubmit =
    !!accountId &&
    amountMinor > 0 &&
    (!isWithdrawal || !!signatureId) &&
    denomComplete &&
    !submitting;

  function resetAfterDone() {
    setAmount("");
    setDescription("");
    setDepositorName("");
    setDepositorAddress("");
    setSignatureId("");
    setDenomLines([]);
    setDenomTotalMinor(0);
    setDenomResetKey((k) => k + 1);
  }

  async function doSubmit() {
    if (!token) return;
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);
    try {
      let envelope: TransactionEnvelope;
      if (isWithdrawal) {
        envelope = await storeCashWithdrawal(token, session.public_id, {
          customer_account_public_id: accountId,
          amount_minor: amountMinor,
          currency,
          initiator_type: initiatorType,
          signature_public_id: signatureId,
          signature_verification_method: method,
          description: description.trim() || null,
          denomination_counts: requiresDenominations ? denomLines : undefined,
        });
      } else {
        envelope = await storeCashDeposit(token, session.public_id, {
          customer_account_public_id: accountId,
          amount_minor: amountMinor,
          currency,
          initiator_type: initiatorType,
          depositor_name: depositorName.trim() || null,
          depositor_address: depositorAddress.trim() || null,
          description: description.trim() || null,
          denomination_counts: requiresDenominations ? denomLines : undefined,
        });
      }
      setConfirmOpen(false);
      onDone(envelope.teller_transaction, direction);
      setReceipt({
        tx: envelope.teller_transaction,
        openingFeeMinor: envelope.opening_fee?.amount_minor ?? null,
        currency,
        direction,
        accountNumber: selectedAccount?.account_number ?? "—",
        holder: holderName,
        amountMinor,
        amountWords,
      });
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

  /**
   * IMPRIMER LE REÇU — the accounting team's print button after every cash
   * entry. The receipt repeats the operation's identity (pièce de caisse,
   * date, account, holder, amount) and, when the API swept an account opening
   * fee on this first transaction, that line too.
   */
  function printReceipt() {
    if (!receipt) return;
    const printed = printCashReceipt({
      transaction: receipt.tx,
      labels: {
        fileName: t("cashTx.receipt.fileName"),
        heading: t("cashTx.receipt.heading"),
        reference: t("cashTx.receipt.reference"),
        date: t("cashTx.receipt.date"),
        type: t("cashTx.receipt.type"),
        typeLabel: t(`cashTx.txType.${receipt.tx.transaction_type}`),
        account: t("cashTx.receipt.account"),
        holder: t("cashTx.receipt.holder"),
        amount: t("cashTx.receipt.amount"),
        amountInWords: t("cashTx.receipt.amountInWords"),
        openingFee: t("cashTx.receipt.openingFee"),
        detail: t("cashTx.receipt.label"),
        value: t("cashTx.receipt.value"),
        generatedOn: t("common.generatedOn"),
        status: t("cashTx.recent.status"),
        statusLabel: t(`cashTx.status.${receipt.tx.status}`),
      },
      formattedAmount: format.currencyMinor(receipt.amountMinor, {
        currency: receipt.currency,
      }),
      amountInWords: receipt.amountWords || undefined,
      formattedOpeningFee:
        receipt.openingFeeMinor !== null
          ? format.currencyMinor(receipt.openingFeeMinor, {
              currency: receipt.currency,
            })
          : undefined,
    });
    if (!printed) {
      window.alert(t("cashTx.receipt.printError"));
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
                    : balanceUnavailable
                      ? "—"
                      : "…"}
                </span>
                {balanceUnavailable ? (
                  <span className="text-[0.7rem] text-warning">
                    {t("cashTx.account.balanceUnavailable")}
                  </span>
                ) : null}
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

        {/* 2b. Cash denomination breakdown — only when the till requires it */}
        {requiresDenominations ? (
          <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-background p-5">
            <div className="flex flex-col gap-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("cashTx.section.denominations")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("cashTx.denominations.hint")}
              </p>
            </div>
            <DenominationCounter
              key={denomResetKey}
              currency={currency}
              targetMinor={amountMinor > 0 ? amountMinor : null}
              onChange={(lines, total) => {
                setDenomLines(lines);
                setDenomTotalMinor(total);
              }}
            />
            {amountMinor > 0 && denomTotalMinor !== amountMinor ? (
              <p className="text-xs text-warning">
                {t("cashTx.denominations.mismatch")}
              </p>
            ) : null}
          </section>
        ) : null}

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
              setReceipt(null);
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

        {/* ---- Receipt of the last posted operation ---- */}
        {receipt ? (
          <section
            ref={receiptRef}
            className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-success/40 bg-success/5 p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-semibold text-success">
                  {t("cashTx.receipt.title")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("cashTx.receipt.postedNote")}{" "}
                  <span className="font-mono text-foreground">
                    {receipt.tx.reference ?? "—"}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={printReceipt}
                >
                  {t("cashTx.receipt.print")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setReceipt(null);
                    setClient(null);
                    setAccountId("");
                    resetAfterDone();
                  }}
                >
                  {t("cashTx.receipt.newOperation")}
                </Button>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              {/*
                The API's own account number and holder, with the form's as a
                fallback — the printed receipt reads the same two fields, and a
                panel sourced differently would eventually disagree with the
                slip handed to the customer.
              */}
              <SummaryRow
                label={t("cashTx.receipt.account")}
                value={receipt.tx.customer_account_number ?? receipt.accountNumber}
              />
              <SummaryRow
                label={t("cashTx.receipt.holder")}
                value={receipt.tx.client_display_name ?? receipt.holder}
              />
              <SummaryRow
                label={t("cashTx.receipt.amount")}
                value={
                  <span className="font-semibold tabular-nums">
                    {format.currencyMinor(receipt.amountMinor, {
                      currency: receipt.currency,
                    })}
                  </span>
                }
              />
              <SummaryRow
                label={t("cashTx.receipt.date")}
                value={receipt.tx.transaction_date ?? "—"}
              />
              <SummaryRow
                label={t("cashTx.receipt.type")}
                value={t(`cashTx.txType.${receipt.tx.transaction_type}`)}
              />
              <SummaryRow
                label={t("cashTx.receipt.reference")}
                value={receipt.tx.reference ?? "—"}
              />
              {receipt.openingFeeMinor !== null ? (
                <SummaryRow
                  label={t("cashTx.receipt.openingFee")}
                  value={
                    <span className="font-semibold tabular-nums text-warning">
                      {format.currencyMinor(receipt.openingFeeMinor, {
                        currency: receipt.currency,
                      })}
                    </span>
                  }
                />
              ) : null}
            </dl>
          </section>
        ) : null}
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
          {pendingOpeningFeeMinor > 0 ? (
            <>
              <SummaryRow
                label={t("cashTx.receipt.openingFee")}
                value={
                  <span className="font-semibold tabular-nums text-warning">
                    {format.currencyMinor(pendingOpeningFeeMinor, { currency })}
                  </span>
                }
              />
              <p className="text-xs text-muted-foreground">
                {t("cashTx.summary.openingFeeNote")}
              </p>
            </>
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
