"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * useState with localStorage persistence. Reads the stored value on the first
 * client paint (so SSR matches the `initial` value and there's no hydration
 * mismatch). Subsequent writes are mirrored to storage.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
  parser?: (raw: string) => T | null,
): [T, (next: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(key);
    if (stored === null) return;
    try {
      const parsed = parser ? parser(stored) : (JSON.parse(stored) as T);
      if (parsed !== null && parsed !== undefined) setValue(parsed);
    } catch {
      // Malformed value — keep the initial.
    }
  }, [key, parser]);

  const update = useCallback(
    (next: T | ((current: T) => T)) => {
      setValue((current) => {
        const resolved =
          typeof next === "function" ? (next as (c: T) => T)(current) : next;
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(key, JSON.stringify(resolved));
          } catch {
            // Storage quota / privacy mode — best-effort.
          }
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, update];
}
