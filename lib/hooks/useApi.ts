"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";

type UseApiState<T> = {
  data: T | null;
  loading: boolean;
  error: ApiError | Error | null;
};

export type UseApiResult<T> = UseApiState<T> & {
  /** Force a re-fetch using the same fn. */
  refetch: () => void;
  /** Override the data locally (e.g. after a mutation). */
  setData: (next: T | null) => void;
};

/**
 * Tiny fetch-state manager. Run `fn` on mount and whenever `deps` change.
 * Cancellation is best-effort via `AbortController` passed to `fn`.
 *
 * For complex caches/revalidation, swap for SWR / TanStack Query later — for
 * now this is enough.
 */
export function useApi<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  deps: ReadonlyArray<unknown>,
): UseApiResult<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const [version, setVersion] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));

    fnRef
      .current(controller.signal)
      .then((data) => {
        if (cancelled) return;
        setState({ data, loading: false, error: null });
      })
      .catch((cause: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        const error =
          cause instanceof ApiError
            ? cause
            : cause instanceof Error
              ? cause
              : new Error("Unknown error");
        setState({ data: null, loading: false, error });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback(
    (next: T | null) =>
      setState((current) => ({ ...current, data: next, error: null })),
    [],
  );

  return { ...state, refetch, setData };
}
