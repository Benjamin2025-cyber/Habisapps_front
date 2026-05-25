"use client";

import { cn } from "@/lib/cn";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

type OtpInputProps = {
  length?: number;
  value: string;
  onChange: (next: string) => void;
  /** Called when the user reaches the last digit. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Toggle red border state. */
  invalid?: boolean;
  ariaLabel?: string;
};

/**
 * 6-digit (configurable) OTP input. Pastes are spread across boxes, arrow keys
 * navigate, Backspace on an empty box jumps to the previous one.
 */
export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = false,
  invalid = false,
  ariaLabel,
}: OtpInputProps) {
  const t = useTranslations();
  const groupLabel = ariaLabel ?? t("auth.shared.otpAriaLabelDefault");
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const [focused, setFocused] = useState(0);

  useEffect(() => {
    if (autoFocus) inputsRef.current[0]?.focus();
  }, [autoFocus]);

  const setChar = useCallback(
    (index: number, char: string) => {
      const next = value.split("");
      next[index] = char;
      const joined = next.join("").slice(0, length);
      onChange(joined);
      if (joined.length === length && onComplete) onComplete(joined);
    },
    [value, length, onChange, onComplete],
  );

  const handleChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 0) {
      setChar(index, "");
      return;
    }
    if (digits.length === 1) {
      setChar(index, digits);
      if (index < length - 1) inputsRef.current[index + 1]?.focus();
      return;
    }
    // Multi-char input (autofill / paste fallback) — distribute starting here.
    const merged = (value.slice(0, index) + digits).slice(0, length);
    onChange(merged);
    const nextFocus = Math.min(merged.length, length - 1);
    inputsRef.current[nextFocus]?.focus();
    if (merged.length === length && onComplete) onComplete(merged);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      if (value[index]) {
        setChar(index, "");
      } else if (index > 0) {
        event.preventDefault();
        inputsRef.current[index - 1]?.focus();
        setChar(index - 1, "");
      }
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputsRef.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const digits = event.clipboardData.getData("text").replace(/\D/g, "");
    if (digits.length === 0) return;
    event.preventDefault();
    const merged = digits.slice(0, length);
    onChange(merged);
    const nextFocus = Math.min(merged.length, length - 1);
    inputsRef.current[nextFocus]?.focus();
    if (merged.length === length && onComplete) onComplete(merged);
  };

  return (
    <div
      role="group"
      aria-label={groupLabel}
      className="flex items-center justify-center gap-2 sm:gap-3"
    >
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(node) => {
            inputsRef.current[index] = node;
          }}
          value={value[index] ?? ""}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={() => setFocused(index)}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          aria-label={t("auth.shared.otpDigitAriaLabel", { position: index + 1 })}
          className={cn(
            "h-14 w-12 rounded-[var(--radius-field)] border bg-background text-center text-xl font-semibold",
            "transition-colors focus:outline-none",
            invalid
              ? "border-danger focus:border-danger focus:ring-2 focus:ring-danger/20"
              : "border-input focus:border-foreground/30 focus:ring-2 focus:ring-ring/10",
            disabled && "cursor-not-allowed opacity-60",
            focused === index && !invalid && "border-foreground/30",
          )}
        />
      ))}
    </div>
  );
}
