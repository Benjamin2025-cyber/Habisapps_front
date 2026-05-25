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
import { apiRequest } from "@/lib/api/client";
import type { StaffUser } from "@/lib/api/types";
import { sessionStorageDriver, type StoredSession } from "./session-storage";

type SessionState =
  | { status: "loading"; user: null; token: null }
  | { status: "authenticated"; user: StaffUser; token: string }
  | { status: "anonymous"; user: null; token: null };

type SessionContextValue = SessionState & {
  signIn: (session: StoredSession) => void;
  signOut: () => Promise<void>;
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

  const value = useMemo<SessionContextValue>(
    () => ({ ...state, signIn, signOut }),
    [state, signIn, signOut],
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
