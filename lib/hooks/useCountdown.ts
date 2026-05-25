"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n/I18nProvider";

/**
 * Real-time countdown in seconds. Setting a new `target` resets the timer.
 * Returns `0` when the countdown has expired (or when no target was set).
 */
export function useCountdown(target: number | null): number {
  const [remaining, setRemaining] = useState<number>(target ?? 0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (target === null || target <= 0) {
      setRemaining(0);
      return;
    }

    setRemaining(target);
    intervalRef.current = window.setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          if (intervalRef.current !== null) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [target]);

  return remaining;
}

/**
 * Localized countdown formatter — returns "42 s" or "1 min 05 s" using the
 * active locale's number format.
 */
export function useCountdownFormatter(): (seconds: number) => string {
  const t = useTranslations();
  return (seconds: number) => {
    if (seconds <= 0) return t("duration.seconds", { count: 0 });
    if (seconds < 60) return t("duration.seconds", { count: seconds });
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return t("duration.minutesSeconds", {
      minutes,
      seconds: remainder.toString().padStart(2, "0"),
    });
  };
}
