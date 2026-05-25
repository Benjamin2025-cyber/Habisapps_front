import type { StaffUser } from "@/lib/api/types";

const TOKEN_KEY = "habis.auth.token";
const USER_KEY = "habis.auth.user";

export type StoredSession = {
  token: string;
  user: StaffUser;
};

/**
 * localStorage-backed session store. Safe to call during SSR — returns `null`
 * when `window` is unavailable.
 */
export const sessionStorageDriver = {
  read(): StoredSession | null {
    if (typeof window === "undefined") return null;
    const token = window.localStorage.getItem(TOKEN_KEY);
    const userJson = window.localStorage.getItem(USER_KEY);
    if (!token || !userJson) return null;
    try {
      const user = JSON.parse(userJson) as StaffUser;
      return { token, user };
    } catch {
      return null;
    }
  },

  write(session: StoredSession): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TOKEN_KEY, session.token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  },

  clear(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  },
};
