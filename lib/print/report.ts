/**
 * Branded, print-ready report generator.
 *
 * Opens a self-contained A4 document in a new window and triggers the browser
 * print dialog, where the user chooses **Imprimer** (printer) or **Enregistrer
 * au format PDF** (download). Dependency-free (no PDF lib) and works in this
 * custom Next build.
 *
 * Every report carries the HabisLoan logo header — pass content; the branding
 * is added here so it's consistent across the app.
 */
export type ReportMeta = { label: string; value: string };

export type BrandedReportOptions = {
  /** Document <title> — becomes the default file name on "Save as PDF". */
  documentTitle: string;
  /** Report H1. */
  heading: string;
  /** Optional line under the heading. */
  subheading?: string;
  /** Key/value summary shown above the table (loan, client, agency…). */
  meta?: ReportMeta[];
  columns: string[];
  rows: Array<Array<string | number | null | undefined>>;
  /** Column indexes that should be right-aligned (numbers/amounts). */
  numericColumns?: number[];
  /** Label prefixing the generation timestamp, e.g. "Généré le". */
  generatedLabel: string;
  /** Shown when there are no rows. */
  emptyLabel: string;
  /**
   * Name shown next to the logo. Defaults to the product's own wordmark, but a
   * document handed to a customer is issued by the institution, not by the
   * software: « Le logo à afficher sur les reçus est celui d'Habibi Finance
   * S.A » (14/09/2026). Pass the institution profile's legal or trade name and
   * the receipt is signed by them.
   */
  brandName?: string;
  /**
   * Page orientation. Portrait suits a statement's five columns; a wide sheet
   * such as the ten-column brouillard de caisse needs `landscape`, or A4 leaves
   * each column about 18 mm and the references and amounts wrap into an
   * unreadable block. Landscape also tightens the type, since a table is only
   * that wide because it has a lot to say.
   */
  orientation?: "portrait" | "landscape";
  /**
   * Paper size. A cash receipt holds a dozen lines; on A4 it fills the top
   * third and the counter throws away two thirds of every sheet. A5 is the
   * half-format the guichet actually uses.
   */
  pageSize?: "A4" | "A5";
  /**
   * Serif typography for documents handed to a customer. The screen stack
   * (ui-sans-serif → system-ui) resolves to whatever the workstation has and
   * printed muddy on the counter's laser; a named serif prints the same
   * everywhere.
   */
  serif?: boolean;
  /** Drop the brand strip under the table — a receipt ends on its signatures. */
  hideFooter?: boolean;
  /**
   * Signature blocks across the foot of the document: « Le Client », « Le
   * Caissier », « Cachet ». Each gets a ruled space to sign above its label.
   */
  signatures?: string[];
};

function esc(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Builds the report HTML and opens it in a print window. Must run client-side
 * from a user gesture (button click) so the popup isn't blocked.
 */
export function openBrandedReport(options: BrandedReportOptions): boolean {
  if (typeof window === "undefined") return false;

  const {
    documentTitle,
    heading,
    subheading,
    meta = [],
    columns,
    rows,
    numericColumns = [],
    generatedLabel,
    emptyLabel,
    brandName = "HabisLoan",
    orientation = "portrait",
    pageSize = "A4",
    serif = false,
    hideFooter = false,
    signatures = [],
  } = options;

  const isLandscape = orientation === "landscape";
  const isCompact = pageSize === "A5";

  const origin = window.location.origin;
  const logoUrl = `${origin}/brand/logo-icon.png`;
  const generatedAt = new Date().toLocaleString("fr-FR");
  const numeric = new Set(numericColumns);

  const headHtml = columns
    .map(
      (c, i) =>
        `<th class="${numeric.has(i) ? "num" : ""}">${esc(c)}</th>`,
    )
    .join("");

  const bodyHtml =
    rows.length === 0
      ? `<tr><td class="empty" colspan="${columns.length}">${esc(emptyLabel)}</td></tr>`
      : rows
          .map(
            (row) =>
              `<tr>${row
                .map(
                  (cell, i) =>
                    `<td class="${numeric.has(i) ? "num" : ""}">${esc(cell)}</td>`,
                )
                .join("")}</tr>`,
          )
          .join("");

  const metaHtml = meta
    .map(
      (m) =>
        `<div class="meta-item"><span class="meta-label">${esc(m.label)}</span><span class="meta-value">${esc(m.value)}</span></div>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${esc(documentTitle)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ${serif ? '"Times New Roman", Times, serif' : 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'};
    color: #1a1a2e;
    padding: ${isCompact ? "14px 16px" : "28px 32px"};
    font-size: ${serif ? "11pt" : isLandscape ? "10px" : "12px"};
  }
  .brand { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: ${isCompact ? "6px" : "14px"}; }
  .brand img { width: ${isCompact ? "32px" : "48px"}; height: ${isCompact ? "32px" : "48px"}; object-fit: contain; }
  .brand .name { font-size: ${isCompact ? "15px" : "20px"}; font-weight: 800; letter-spacing: -0.5px; }
  .brand .name .accent { color: #a3158a; }
  .brand .name .primary { color: #0b1020; }
  .doc-head { margin-top: ${isCompact ? "8px" : "18px"}; }
  .doc-head h1 { font-size: ${isCompact ? "13px" : "17px"}; margin: 0; }
  .doc-head .sub { color: #6b7280; margin-top: 2px; }
  .doc-head .generated { color: #9ca3af; font-size: 10px; margin-top: 4px; }
  .meta { display: flex; flex-wrap: wrap; gap: ${isCompact ? "4px 20px" : "8px 28px"}; margin: ${isCompact ? "8px 0 8px" : "16px 0 18px"}; }
  .meta-item { display: flex; flex-direction: column; }
  .meta-label { text-transform: uppercase; font-size: 9px; letter-spacing: 0.04em; color: #9ca3af; font-weight: 700; }
  .meta-value { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  thead th {
    text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em;
    color: #6b7280; border-bottom: 1.5px solid #d1d5db; padding: ${isCompact ? '4px 6px' : isLandscape ? '6px 6px' : '8px 10px'}; background: #f9fafb;
  }
  tbody td { padding: ${isCompact ? '3px 6px' : isLandscape ? '5px 6px' : '8px 10px'}; border-bottom: 1px solid #eef0f3; vertical-align: top; }
  /* A long sheet repeats its header on every page; the accounting team signs
     each one, and an unlabelled page 3 is not a document. */
  thead { display: table-header-group; }
  tbody tr { break-inside: avoid; page-break-inside: avoid; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .empty { text-align: center; color: #9ca3af; padding: 28px 10px; }
  tbody tr:nth-child(even) { background: #fcfcfd; }
  .foot { margin-top: 22px; border-top: 1px solid #e5e7eb; padding-top: 8px; color: #9ca3af; font-size: 9px; display: flex; justify-content: space-between; }
  .signatures { display: flex; gap: 16px; margin-top: ${isCompact ? "14px" : "26px"}; page-break-inside: avoid; break-inside: avoid; }
  .signatures .sig { flex: 1; text-align: center; }
  /* Room to actually sign, then the rule, then the label beneath it. */
  .signatures .sig .space { height: ${isCompact ? "42px" : "64px"}; }
  .signatures .sig .rule { border-top: 1px solid #1a1a2e; margin: 0 6px; }
  .signatures .sig .who { margin-top: 5px; font-size: ${serif ? "10pt" : "10px"}; font-weight: 700; }
  @page { size: ${pageSize} ${orientation}; margin: ${isCompact ? "8mm" : isLandscape ? "10mm" : "14mm"}; }
  @media print { body { padding: 0; } .num, tbody tr:nth-child(even) { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  <header class="brand">
    <img src="${esc(logoUrl)}" alt="" />
    <div class="name">${brandName === "HabisLoan"
      ? '<span class="primary">Habis</span><span class="accent">Loan</span>'
      : `<span class="primary">${esc(brandName)}</span>`}</div>
  </header>
  <div class="doc-head">
    <h1>${esc(heading)}</h1>
    ${subheading ? `<div class="sub">${esc(subheading)}</div>` : ""}
    <div class="generated">${esc(generatedLabel)} ${esc(generatedAt)}</div>
  </div>
  ${meta.length ? `<div class="meta">${metaHtml}</div>` : ""}
  <table>
    <thead><tr>${headHtml}</tr></thead>
    <tbody>${bodyHtml}</tbody>
  </table>
  ${signatures.length
    ? `<div class="signatures">${signatures
        .map((who) => `<div class="sig"><div class="space"></div><div class="rule"></div><div class="who">${esc(who)}</div></div>`)
        .join("")}</div>`
    : ""}
  ${hideFooter
    ? ""
    : `<div class="foot"><span>${esc(brandName)}</span><span>${esc(documentTitle)}</span></div>`}
  <script>
    window.addEventListener("load", function () {
      // Give the logo a moment to paint before opening the print dialog.
      setTimeout(function () { window.focus(); window.print(); }, 350);
    });
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=920,height=760");
  if (!win) return false; // popup blocked
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
