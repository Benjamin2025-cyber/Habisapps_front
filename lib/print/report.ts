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
  /** App/brand name shown next to the logo. */
  brandName?: string;
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
  } = options;

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
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #1a1a2e;
    padding: 28px 32px;
    font-size: 12px;
  }
  .brand { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: 14px; }
  .brand img { width: 48px; height: 48px; object-fit: contain; }
  .brand .name { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
  .brand .name .accent { color: #a3158a; }
  .brand .name .primary { color: #0b1020; }
  .doc-head { margin-top: 18px; }
  .doc-head h1 { font-size: 17px; margin: 0; }
  .doc-head .sub { color: #6b7280; margin-top: 2px; }
  .doc-head .generated { color: #9ca3af; font-size: 10px; margin-top: 4px; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px 28px; margin: 16px 0 18px; }
  .meta-item { display: flex; flex-direction: column; }
  .meta-label { text-transform: uppercase; font-size: 9px; letter-spacing: 0.04em; color: #9ca3af; font-weight: 700; }
  .meta-value { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  thead th {
    text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em;
    color: #6b7280; border-bottom: 1.5px solid #d1d5db; padding: 8px 10px; background: #f9fafb;
  }
  tbody td { padding: 8px 10px; border-bottom: 1px solid #eef0f3; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .empty { text-align: center; color: #9ca3af; padding: 28px 10px; }
  tbody tr:nth-child(even) { background: #fcfcfd; }
  .foot { margin-top: 22px; border-top: 1px solid #e5e7eb; padding-top: 8px; color: #9ca3af; font-size: 9px; display: flex; justify-content: space-between; }
  @page { size: A4; margin: 14mm; }
  @media print { body { padding: 0; } .num, tbody tr:nth-child(even) { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  <header class="brand">
    <img src="${esc(logoUrl)}" alt="" />
    <div class="name"><span class="primary">Habis</span><span class="accent">Loan</span></div>
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
  <div class="foot">
    <span>${esc(brandName)}</span>
    <span>${esc(documentTitle)}</span>
  </div>
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
