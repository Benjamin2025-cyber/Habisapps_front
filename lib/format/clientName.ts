/**
 * NOM Prénoms — one definition of how a client is named on screen.
 *
 * Mirrors `Client::displayName()` on the API, which is what
 * `client_display_name` carries on the loan and account resources. Prefer that
 * server field when you have it; use this when all you hold is a `Client`
 * (lists, pickers, headings).
 *
 * The middle name is part of the prénoms. Half the screens joined only
 * `last_name` and `first_name`, so the same person read differently depending
 * on where you looked and clients with a second prénom appeared truncated —
 * « le nom du client ne s'affiche pas entièrement ».
 *
 * Returns an empty string when there is nothing to show, so callers keep their
 * own fallback (client reference, public id, an em dash).
 */
export function clientDisplayName(client: {
  last_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
}): string {
  return [client.last_name?.toUpperCase(), client.first_name, client.middle_name]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part && part.length > 0)
    .join(" ");
}
