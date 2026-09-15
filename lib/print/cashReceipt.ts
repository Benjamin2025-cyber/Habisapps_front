import type { TellerTransaction } from "@/lib/api/teller-transactions";
import { openBrandedReport } from "./report";

/**
 * « IMPRIMER le reçu » — the accounting team asked for it after *toute*
 * opération saisie, which is more than the one still on screen: a teller who
 * has moved on to the next customer, or who is handed back a slip that never
 * printed, needs the receipt of any operation of the session.
 *
 * Shared by the entry form and the session's operation list so the two cannot
 * print different receipts for the same operation. The labels are resolved
 * here, from the caller's translator, rather than assembled by each caller —
 * two hand-written dictionaries are exactly how the two receipts drift apart.
 *
 * Format follows CORRECTIONS HABISLOAN 14/09/2026, deuxième préoccupation:
 * A5 (half-sheet), Times New Roman 11, three signature blocks, and no page
 * footer — the counter was printing one operation across two A4 sheets.
 */
export type CashReceiptInput = {
  transaction: TellerTransaction;
  /** The caller's translator; this module owns which keys it needs. */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Formatted by the caller, which owns the locale and the currency. */
  formattedAmount: string;
  amountInWords?: string;
  /** Present only on the operation that actually swept it. */
  formattedOpeningFee?: string;
  /** Institution legal/trade name; the receipt is issued by them, not by us. */
  institutionName?: string;
};

export function printCashReceipt(input: CashReceiptInput): boolean {
  const { transaction: tx, t } = input;

  const rows: Array<[string, string]> = [
    [t("cashTx.receipt.account"), tx.customer_account_number ?? "—"],
    [t("cashTx.receipt.holder"), tx.client_display_name ?? "—"],
    [t("cashTx.receipt.amount"), input.formattedAmount],
  ];

  if (input.amountInWords) {
    rows.push([t("cashTx.receipt.amountInWords"), input.amountInWords]);
  }
  // « Le mode de règlement doit être ajouté comme rubrique du reçu […]
  // (espèces, orange money cameroun, mtn mobile money cameroun, autres) ».
  // The tender's channel names the operator where the payment method only says
  // "transfer", and the counter needs the operator: the institution's caisse
  // plan gives Orange Money and MTN their own sub-caisses.
  const channel = tx.tenders?.find((tender) => tender.channel)?.channel;
  rows.push([
    t("cashTx.receipt.paymentMethod"),
    channel && channel !== "branch_counter"
      ? t(`cashTx.channel.${channel}`)
      : tx.payment_method
        ? t(`cashTx.paymentMethod.${tx.payment_method}`)
        : "—",
  ]);
  // « Les références de la pièce d'identité du déposant » — only on the
  // operations that have a depositor to identify.
  if (tx.depositor_name || tx.depositor_id_reference) {
    rows.push([t("cashTx.receipt.depositor"), tx.depositor_name ?? "—"]);
    rows.push([
      t("cashTx.receipt.depositorId"),
      tx.depositor_id_reference ?? "—",
    ]);
  }
  if (input.formattedOpeningFee) {
    rows.push([t("cashTx.receipt.openingFee"), input.formattedOpeningFee]);
  }
  // A reversed operation must say so on its face, or the reprint of an annulled
  // receipt is indistinguishable from a live one.
  rows.push([t("cashTx.recent.status"), t(`cashTx.status.${tx.status}`)]);

  return openBrandedReport({
    documentTitle: t("cashTx.receipt.fileName"),
    ...(input.institutionName ? { brandName: input.institutionName } : {}),
    heading: t("cashTx.receipt.heading"),
    meta: [
      { label: t("cashTx.receipt.reference"), value: tx.reference ?? "—" },
      { label: t("cashTx.receipt.date"), value: tx.transaction_date ?? "—" },
      {
        label: t("cashTx.receipt.type"),
        value: t(`cashTx.txType.${tx.transaction_type}`),
      },
      // « Le code guichet doit être ajouté comme rubrique du reçu ».
      { label: t("cashTx.receipt.branchCode"), value: tx.agency_code ?? "—" },
    ],
    columns: [t("cashTx.receipt.label"), t("cashTx.receipt.value")],
    rows,
    numericColumns: [],
    generatedLabel: t("common.generatedOn"),
    emptyLabel: "",
    pageSize: "A5",
    // « la dimension A5 / un demi format / 21cm sur 15 » — 21 wide by 15 tall
    // is A5 on its side, i.e. an A4 sheet halved across. Portrait A5 would be
    // 15 by 21 and is not what the guichet cuts its paper to.
    orientation: "landscape",
    serif: true,
    hideFooter: true,
    signatures: [
      t("cashTx.receipt.signatureClient"),
      t("cashTx.receipt.signatureTeller"),
      t("cashTx.receipt.signatureStamp"),
    ],
  });
}
