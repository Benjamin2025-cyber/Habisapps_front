/**
 * Branded, print-ready report generator.
 *
 * Opens a self-contained A4 document in a new window and triggers the browser
 * print dialog, where the user chooses **Imprimer** (printer) or **Enregistrer
 * au format PDF** (download). Dependency-free (no PDF lib) and works in this
 * custom Next build.
 *
 * Every report carries Habibi Finance's own letterhead — logo, regulatory
 * tagline and registered-office footer, copied from the institution's
 * "papier entête" — so pass content; the branding is added here once, the
 * same on every document.
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
   * Alt text for the letterhead logo — the institution's own legal or trade
   * name, when the caller has it (a teller reads it from /me rather than the
   * institution profile, which they cannot see). The letterhead itself is
   * Habibi Finance's actual logo file, so this only ever affects what a
   * screen reader or broken-image placeholder announces, not what prints.
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
    brandName = "Habibi Finance",
    orientation = "portrait",
    pageSize = "A4",
    serif = false,
    signatures = [],
  } = options;

  const isLandscape = orientation === "landscape";
  const isCompact = pageSize === "A5";

  const origin = window.location.origin;
  const logoUrl = `${origin}/brand/full-logo.png`;
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
  /* The institution's own letterhead: logo, gradient rule, regulatory
     tagline — reproduced from "Habibi Finance — Papier Entête" so every
     printed document, not just the counter's receipts, carries it. */
  .letterhead-head { display: flex; flex-direction: column; align-items: center; text-align: center; }
  .letterhead-logo { height: ${isCompact ? "30px" : "44px"}; width: auto; object-fit: contain; }
  .letterhead-rule { width: 100%; height: 3px; margin-top: ${isCompact ? "6px" : "10px"}; background: linear-gradient(90deg, #2dd4bf 0%, #14062f 50%, #a3158a 100%); }
  .letterhead-tagline { margin-top: ${isCompact ? "4px" : "6px"}; font-style: italic; color: #6b7280; font-size: ${isCompact ? "8px" : "9px"}; }
  .letterhead-foot { margin-top: ${isCompact ? "10px" : "18px"}; page-break-inside: avoid; break-inside: avoid; }
  .letterhead-foot .letterhead-rule { margin-top: 0; margin-bottom: ${isCompact ? "4px" : "6px"}; }
  .letterhead-foot .row { display: flex; justify-content: space-between; gap: 12px; font-size: ${isCompact ? "8px" : "9px"}; color: #4b5563; }
  .letterhead-foot .row u { text-decoration: underline; font-style: italic; }
  .letterhead-foot .row b { font-weight: 700; color: #1a1a2e; }
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
  <header class="letterhead-head">
    <img class="letterhead-logo" src="${esc(logoUrl)}" alt="${esc(brandName)}" />
    <div class="letterhead-rule"></div>
    <div class="letterhead-tagline">Établissement de Microfinance de 2ème catégorie&nbsp;&bull;&nbsp;Société Anonyme au capital social de FCFA 300&nbsp;000&nbsp;000</div>
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
  <footer class="letterhead-foot">
    <div class="letterhead-rule"></div>
    <div class="row">
      <span><u>Siège social :</u> <b>Yaoundé, Tsinga — Avenue John Ngu Foncha</b></span>
      <span><u>Courriel :</u> <b>habibifinance.sa@gmail.com</b></span>
    </div>
  </footer>
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
