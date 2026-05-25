/**
 * Best-effort masking for a phone number, used in OTP prompts so the user can
 * confirm they typed the right number without exposing the full value on screen.
 * Keeps the country prefix + first 2 digits + last 2 digits.
 */
export function maskPhoneNumber(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length <= 6) return trimmed;
  const head = trimmed.slice(0, 4);
  const tail = trimmed.slice(-2);
  return `${head} •• •• ${tail}`;
}

/**
 * Minimal phone normalizer — strips spaces, dashes, and parentheses. Keeps the
 * leading `+`. The API accepts the value as-is so the heavy lifting lives there.
 */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-()]/g, "").trim();
}
