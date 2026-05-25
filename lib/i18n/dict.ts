/**
 * Nested string dictionary loaded from `messages/*.json`. Values can be either
 * a string template (with `{name}` placeholders) or another nested dictionary.
 */
export type Messages = {
  [key: string]: string | Messages;
};

/**
 * Resolve a dotted path like `"auth.login.title"` against a nested dictionary.
 * Returns `null` when the key is missing or points to a sub-tree instead of
 * a string.
 */
export function lookup(messages: Messages, key: string): string | null {
  const segments = key.split(".");
  let cursor: string | Messages = messages;
  for (const segment of segments) {
    if (typeof cursor !== "object" || cursor === null) return null;
    const next: string | Messages | undefined = (cursor as Messages)[segment];
    if (next === undefined) return null;
    cursor = next;
  }
  return typeof cursor === "string" ? cursor : null;
}

/**
 * Substitute `{name}` placeholders with values from `params`. Missing values
 * stay as the original placeholder so the dev sees the missing binding.
 */
export function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
