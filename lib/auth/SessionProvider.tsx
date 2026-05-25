"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import type { MeResponse, StaffUser } from "@/lib/api/types";
import { fetchMeRequest } from "./api";
import { sessionStorageDriver, type StoredSession } from "./session-storage";

type SessionState =
  | { status: "loading"; user: null; token: null }
  | { status: "authenticated"; user: StaffUser; token: string }
  | { status: "anonymous"; user: null; token: null };

type SessionContextValue = SessionState & {
  signIn: (session: StoredSession) => void;
  signOut: () => Promise<void>;
  /** Refresh the user from `GET /me`. Picks up role/permission changes without re-login. */
  refresh: () => Promise<StaffUser | null>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    status: "loading",
    user: null,
    token: null,
  });

  // Hydrate from localStorage on first client paint.
  useEffect(() => {
    const stored = sessionStorageDriver.read();
    if (stored) {
      setState({ status: "authenticated", user: stored.user, token: stored.token });

      // Self-heal sessions persisted before the API shipped `permissions` /
      // `direct_permissions`. We pull the up-to-date payload from `/me` in the
      // background; on 401 we clear the session so the user re-logs in.
      const legacy =
        !Array.isArray(stored.user.permissions) ||
        !Array.isArray(stored.user.direct_permissions);
      if (legacy) {
        fetchMeRequest(stored.token)
          .then((response) => {
            const next: StoredSession = {
              token: stored.token,
              user: response.user,
            };
            sessionStorageDriver.write(next);
            setState({
              status: "authenticated",
              user: response.user,
              token: stored.token,
            });
          })
          .catch((cause: unknown) => {
            if (cause instanceof ApiError && cause.status === 401) {
              sessionStorageDriver.clear();
              setState({ status: "anonymous", user: null, token: null });
            }
            // Other failures are silent — defensive guards in useCan keep the
            // UI rendering until the next manual refresh.
          });
      }
    } else {
      setState({ status: "anonymous", user: null, token: null });
    }
  }, []);

  const signIn = useCallback((session: StoredSession) => {
    sessionStorageDriver.write(session);
    setState({ status: "authenticated", user: session.user, token: session.token });
  }, []);

  const signOut = useCallback(async () => {
    const currentToken = state.status === "authenticated" ? state.token : null;
    sessionStorageDriver.clear();
    setState({ status: "anonymous", user: null, token: null });
    if (currentToken) {
      try {
        await apiRequest("logout", { method: "POST", token: currentToken });
      } catch {
        // Network/Sanctum already invalidated — local state is the source of truth.
      }
    }
  }, [state]);

  const refresh = useCallback(async (): Promise<StaffUser | null> => {
    if (state.status !== "authenticated") return null;
    try {
      const response: MeResponse = await fetchMeRequest(state.token);
      const next: StoredSession = { token: state.token, user: response.user };
      sessionStorageDriver.write(next);
      setState({ status: "authenticated", user: response.user, token: state.token });
      return response.user;
    } catch (cause) {
      // 401 means our token is no longer valid — sign the user out so they go through /login again.
      if (cause instanceof ApiError && cause.status === 401) {
        sessionStorageDriver.clear();
        setState({ status: "anonymous", user: null, token: null });
      }
      return null;
    }
  }, [state]);

  const value = useMemo<SessionContextValue>(
    () => ({ ...state, signIn, signOut, refresh }),
    [state, signIn, signOut, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (ctx === null) {
    throw new Error("useSession must be used inside <SessionProvider>");
  }
  return ctx;
}
