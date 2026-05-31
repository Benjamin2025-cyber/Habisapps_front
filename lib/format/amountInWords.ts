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

/* --------------------------- English number-to-words --------------------------- */

const ONES_EN = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS_EN = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function below100En(n: number): string {
  if (n < 20) return ONES_EN[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? TENS_EN[t] : `${TENS_EN[t]}-${ONES_EN[u]}`;
}

function below1000En(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let s = "";
  if (h > 0) s = `${ONES_EN[h]} hundred`;
  if (r > 0) s = s ? `${s} and ${below100En(r)}` : below100En(r);
  return s;
}

function toWordsEn(n: number): string {
  if (n === 0) return "zero";
  const parts: string[] = [];
  const scales: Array<[string, number]> = [
    ["billion", 1_000_000_000],
    ["million", 1_000_000],
    ["thousand", 1000],
  ];
  let rem = n;
  for (const [name, val] of scales) {
    const q = Math.floor(rem / val);
    if (q > 0) {
      parts.push(`${below1000En(q)} ${name}`);
      rem %= val;
    }
  }
  if (rem > 0) parts.push(below1000En(rem));
  return parts.join(" ");
}

function currencyLabelEn(currency: string): string {
  return currency === "XAF" ? "CFA francs" : currency;
}

export function amountInWordsEn(amountMinor: number, currency = "XAF"): string {
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) return "";
  const whole = Math.floor(amountMinor / 100);
  const cents = amountMinor % 100;
  let s = `${toWordsEn(whole)} ${currencyLabelEn(currency)}`;
  if (cents > 0) s += ` and ${toWordsEn(cents)} cents`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Locale-aware "amount in words" for cash receipts / form helpers. */
export function amountInWords(
  amountMinor: number,
  currency = "XAF",
  locale = "fr",
): string {
  return locale === "en"
    ? amountInWordsEn(amountMinor, currency)
    : amountInWordsFr(amountMinor, currency);
}
