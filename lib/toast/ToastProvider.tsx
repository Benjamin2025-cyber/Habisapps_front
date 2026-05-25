"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Toaster } from "@/components/ui/Toaster";

export type ToastVariant = "success" | "danger" | "warning" | "info";

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastInput = {
  variant?: ToastVariant;
  title?: string;
  description?: string;
  /** Duration before auto-dismiss (ms). Use `Infinity` to keep until dismissed. */
  duration?: number;
  action?: ToastAction;
};

export type Toast = Required<Omit<ToastInput, "action">> & {
  id: string;
  action: ToastAction | null;
};

type ToastContextValue = {
  toasts: Toast[];
  push: (input: ToastInput) => string;
  dismiss: (id: string) => void;
};

const DEFAULT_DURATION_MS = 5000;

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (input: ToastInput): string => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const toast: Toast = {
        id,
        variant: input.variant ?? "info",
        title: input.title ?? "",
        description: input.description ?? "",
        duration: input.duration ?? DEFAULT_DURATION_MS,
        action: input.action ?? null,
      };

      setToasts((current) => [...current, toast]);

      if (Number.isFinite(toast.duration)) {
        const handle = window.setTimeout(() => dismiss(id), toast.duration);
        timers.current.set(id, handle);
      }

      return id;
    },
    [dismiss],
  );

  // Cleanup any pending timers when the provider unmounts (HMR safety).
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((handle) => window.clearTimeout(handle));
      pending.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, push, dismiss }),
    [toasts, push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }

  const helpers = useMemo(
    () => ({
      push: ctx.push,
      dismiss: ctx.dismiss,
      success: (title: string, description?: string) =>
        ctx.push({ variant: "success", title, description }),
      error: (title: string, description?: string) =>
        ctx.push({ variant: "danger", title, description }),
      warning: (title: string, description?: string) =>
        ctx.push({ variant: "warning", title, description }),
      info: (title: string, description?: string) =>
        ctx.push({ variant: "info", title, description }),
    }),
    [ctx],
  );

  return helpers;
}
