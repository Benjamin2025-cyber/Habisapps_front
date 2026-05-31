/**
 * French "montant en lettres" for cash receipts — converts a *_minor amount
 * (scale 2) into words, e.g. 15000000 → "Cent cinquante mille francs CFA".
 * Handles 0..999,999,999 (largest realistic XAF teller amount) + centimes.
 */

const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit",
  "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
];
const TENS = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante"];

// `final` = this group ends the whole number. In French, "vingt" and "cent"
// only keep their plural "s" when they are the very last word; followed by
// mille/million they stay invariable (quatre-vingt mille, deux cent mille).
function below100(n: number, final: boolean): string {
  if (n < 17) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  if (n < 70) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return TENS[t];
    if (u === 1) return `${TENS[t]} et un`;
    return `${TENS[t]}-${UNITS[u]}`;
  }
  if (n < 80) {
    if (n === 71) return "soixante et onze";
    return `soixante-${below100(n - 60, final)}`;
  }
  if (n === 80) return final ? "quatre-vingts" : "quatre-vingt";
  return `quatre-vingt-${below100(n - 80, final)}`;
}

function below1000(n: number, final: boolean): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let s = "";
  if (h === 1) s = "cent";
  else if (h > 1) s = `${UNITS[h]} cent${r === 0 && final ? "s" : ""}`;
  if (r > 0) s = s ? `${s} ${below100(r, final)}` : below100(r, final);
  return s;
}

function toWords(n: number): string {
  if (n === 0) return "zéro";
  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  if (millions > 0) {
    parts.push(
      millions === 1 ? "un million" : `${below1000(millions, false)} millions`,
    );
  }
  if (thousands > 0) {
    parts.push(thousands === 1 ? "mille" : `${below1000(thousands, false)} mille`);
  }
  if (rest > 0) parts.push(below1000(rest, true));
  return parts.join(" ");
}

/** Default currency label for the words. XAF → "francs CFA". */
function currencyLabel(currency: string): string {
  return currency === "XAF" ? "francs CFA" : currency;
}

export function amountInWordsFr(
  amountMinor: number,
  currency = "XAF",
): string {
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) return "";
  const whole = Math.floor(amountMinor / 100);
  const cents = amountMinor % 100;
  let s = `${toWords(whole)} ${currencyLabel(currency)}`;
  if (cents > 0) s += ` et ${toWords(cents)} centimes`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
