import type { TellerTransaction } from "@/lib/api/teller-transactions";
import { openBrandedReport } from "./report";

/**
 * « IMPRIMER le reçu » — the accounting team asked for it after *toute*
 * opération saisie, which is more than the one still on screen: a teller who
 * has moved on to the next customer, or who is handed back a slip that never
 * printed, needs the receipt of any operation of the session.
 *
 * Shared by the entry form and the session's operation list so the two cannot
 * print different receipts for the same operation.
 */
export type CashReceiptInput = {
  transaction: TellerTransaction;
  /** Localised labels; the caller owns the dictionary. */
  labels: {
    fileName: string;
    heading: string;
    reference: string;
    date: string;
    type: string;
    typeLabel: string;
    account: string;
    holder: string;
    amount: string;
    amountInWords?: string;
    openingFee: string;
    detail: string;
    value: string;
    generatedOn: string;
    status: string;
    statusLabel: string;
  };
  /** Formatted by the caller, which owns the locale and the currency. */
  formattedAmount: string;
  amountInWords?: string;
  /** Present only on the operation that actually swept it. */
  formattedOpeningFee?: string;
};

export function printCashReceipt(input: CashReceiptInput): boolean {
  const { transaction: tx, labels } = input;

  const rows: Array<[string, string]> = [
    [labels.account, tx.customer_account_number ?? "—"],
    [labels.holder, tx.client_display_name ?? "—"],
    [labels.amount, input.formattedAmount],
  ];

  if (input.amountInWords && labels.amountInWords) {
    rows.push([labels.amountInWords, input.amountInWords]);
  }
  if (input.formattedOpeningFee) {
    rows.push([labels.openingFee, input.formattedOpeningFee]);
  }
  // A reversed operation must say so on its face, or the reprint of an annulled
  // receipt is indistinguishable from a live one.
  rows.push([labels.status, labels.statusLabel]);

  return openBrandedReport({
    documentTitle: labels.fileName,
    heading: labels.heading,
    subheading: tx.reference ?? "—",
    meta: [
      { label: labels.reference, value: tx.reference ?? "—" },
      { label: labels.date, value: tx.transaction_date ?? "—" },
      { label: labels.type, value: labels.typeLabel },
    ],
    columns: [labels.detail, labels.value],
    rows,
    numericColumns: [],
    generatedLabel: labels.generatedOn,
    emptyLabel: "",
  });
}
