import { ApiError } from "./client";

/**
 * Translates a Laravel-style validation error message (English) for a single
 * field to French, using the localized field label when known.
 *
 * Examples:
 *   "The code field is required."          → "Le champ Code agence est obligatoire."
 *   "The code has already been taken."     → "Le champ Code agence est déjà utilisé."
 *   "The name field must not be greater than 255 characters." → "Le champ Nom de l'agence ne doit pas dépasser 255 caractères."
 *
 * Unknown patterns fall through to a generic prefix so the raw message is
 * still readable.
 */
export function localizeValidationMessage(
  rawMessage: string,
  fieldLabel: string,
): string {
  const label = fieldLabel;
  // Defensive: the API contract is a string here, but a malformed/non-422
  // payload could hand us something else. Never let `.match` throw.
  if (typeof rawMessage !== "string") {
    return `Le champ ${label} est invalide.`;
  }

  if (/is required/i.test(rawMessage)) {
    return `Le champ ${label} est obligatoire.`;
  }
  if (/has already been taken/i.test(rawMessage)) {
    return `Le champ ${label} est déjà utilisé.`;
  }
  const maxMatch = rawMessage.match(/(?:must not be greater than|may not be greater than)\s+(\d+)/i);
  if (maxMatch) {
    return `Le champ ${label} ne doit pas dépasser ${maxMatch[1]} caractères.`;
  }
  const minMatch = rawMessage.match(/must be at least\s+(\d+)/i);
  if (minMatch) {
    return `Le champ ${label} doit contenir au moins ${minMatch[1]} caractères.`;
  }
  if (/must be a valid email/i.test(rawMessage) || /is not a valid email/i.test(rawMessage)) {
    return `Le champ ${label} doit être un email valide.`;
  }
  if (/selected.*is invalid/i.test(rawMessage)) {
    return `Le champ ${label} : la valeur sélectionnée est invalide.`;
  }
  if (/must be a string/i.test(rawMessage)) {
    return `Le champ ${label} doit être du texte.`;
  }
  if (/must be a (?:valid )?date/i.test(rawMessage)) {
    return `Le champ ${label} doit être une date valide.`;
  }
  if (/must be (?:a )?number/i.test(rawMessage) || /must be numeric/i.test(rawMessage)) {
    return `Le champ ${label} doit être un nombre.`;
  }
  if (/must be (?:a )?boolean/i.test(rawMessage)) {
    return `Le champ ${label} doit être vrai ou faux.`;
  }
  if (/format is invalid/i.test(rawMessage) || /is invalid/i.test(rawMessage)) {
    return `Le champ ${label} est invalide.`;
  }
  if (/does not exist/i.test(rawMessage) || /does not match/i.test(rawMessage)) {
    return `Le champ ${label} fait référence à une valeur inconnue.`;
  }
  return `Le champ ${label} : ${rawMessage}`;
}

/**
 * Translates the top-level API error message (the `message` field of the
 * envelope) to French. Falls through to the raw message when unrecognized.
 */
export function localizeApiMessage(rawMessage: string): string {
  if (!rawMessage) return "Une erreur est survenue.";
  if (/validation failed/i.test(rawMessage)) {
    return "La saisie comporte des erreurs. Corrigez les champs en rouge.";
  }
  if (/unauthenticated|unauthorized/i.test(rawMessage)) {
    return "Session expirée. Veuillez vous reconnecter.";
  }
  if (/forbidden/i.test(rawMessage) || /not allowed/i.test(rawMessage)) {
    return "Accès refusé.";
  }
  if (/not found/i.test(rawMessage)) {
    return "Ressource introuvable.";
  }
  if (/too many (?:attempts|requests)/i.test(rawMessage)) {
    return "Trop de tentatives. Veuillez patienter avant de réessayer.";
  }
  if (/network error/i.test(rawMessage)) {
    return "Erreur réseau. Vérifiez votre connexion et réessayez.";
  }
  if (/server error|internal error/i.test(rawMessage)) {
    return "Erreur serveur. Réessayez dans un instant.";
  }
  return rawMessage;
}

/**
 * Combined helper: given an unknown thrown value (ApiError, Error, anything)
 * and a field-label map, returns a `{ generalMessage, fieldErrors }` tuple
 * with all strings in French.
 */
export function localizeApiError(
  error: unknown,
  fieldLabels: Record<string, string> = {},
): {
  generalMessage: string;
  fieldErrors: Record<string, string>;
} {
  if (error instanceof ApiError) {
    const fieldErrors: Record<string, string> = {};
    // Only a 422 carries a field-keyed validation bag. Other statuses (e.g. a
    // dev-mode 500 whose `errors` holds an exception/file/line/trace debug
    // payload) must NOT be treated as field errors — mapping a `trace` array
    // here would feed a stack-frame object into the localizer and crash.
    if (error.status === 422 && error.errors) {
      for (const [field, messages] of Object.entries(error.errors)) {
        const firstString = Array.isArray(messages)
          ? messages.find((m): m is string => typeof m === "string")
          : typeof messages === "string"
            ? messages
            : undefined;
        if (firstString !== undefined) {
          const label = fieldLabels[field] ?? humanize(field);
          fieldErrors[field] = localizeValidationMessage(firstString, label);
        }
      }
    }
    return {
      generalMessage: localizeApiMessage(error.message),
      fieldErrors,
    };
  }
  if (error instanceof Error) {
    return {
      generalMessage: localizeApiMessage(error.message),
      fieldErrors: {},
    };
  }
  return {
    generalMessage: "Une erreur inconnue est survenue.",
    fieldErrors: {},
  };
}

/**
 * Pulls a single field's error from an `ApiError` and returns it localized,
 * or `null` if the field has no error. Convenience for forms that wire
 * field-level messages individually instead of via a flattened map.
 */
export function localizeFieldError(
  error: unknown,
  fieldKey: string,
  fieldLabel: string,
): string | null {
  if (!(error instanceof ApiError)) return null;
  const raw = error.fieldError(fieldKey);
  if (!raw) return null;
  return localizeValidationMessage(raw, fieldLabel);
}

function humanize(field: string): string {
  return field.replace(/_/g, " ");
}
