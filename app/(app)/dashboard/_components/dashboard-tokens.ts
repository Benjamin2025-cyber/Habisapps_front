/**
 * Shared visual tokens for the role dashboards. `Tone` maps to the semantic
 * colour set defined in `app/globals.css`; `toneColorVar` returns the raw CSS
 * variable so it can be used as an SVG `stroke`/`fill` (charts) as well as in
 * Tailwind arbitrary values.
 */
export type Tone =
  | "primary"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

export function toneColorVar(tone: Tone): string {
  if (tone === "neutral") return "var(--color-muted-foreground)";
  return `var(--color-${tone})`;
}

/** Tailwind chip classes (soft background + solid text) for a tone. */
export const TONE_CHIP: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
  neutral: "bg-muted text-muted-foreground",
};
