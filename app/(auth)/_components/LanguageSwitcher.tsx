"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ChevronDownIcon } from "@/components/ui/icons";
import { LOCALES, type Locale } from "@/lib/i18n/locales";
import { useLocale, useTranslations } from "@/lib/i18n/I18nProvider";

export function LanguageSwitcher() {
  const t = useTranslations();
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close the menu when the user clicks/taps outside or hits Escape.
  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const active = LOCALES.find((entry) => entry.code === locale) ?? LOCALES[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("common.language.switcher")}
        className="inline-flex items-center gap-2 rounded-[var(--radius-field)] px-2 py-1.5 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <LocaleFlag locale={active.code} />
        <span>{active.label}</span>
        <ChevronDownIcon className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <ul
          role="listbox"
          className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-[var(--radius-field)] border border-border bg-background shadow-[0_24px_60px_-30px_rgba(20,6,47,0.25)]"
        >
          {LOCALES.map((entry) => {
            const isActive = entry.code === locale;
            const disabled = !entry.available;
            return (
              <li key={entry.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    setLocale(entry.code);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                    isActive && "bg-muted font-semibold",
                    !isActive && !disabled && "hover:bg-muted",
                    disabled && "cursor-not-allowed text-muted-foreground",
                  )}
                >
                  <LocaleFlag locale={entry.code} />
                  <span className="flex-1">{entry.label}</span>
                  {disabled ? (
                    <span className="text-xs text-muted-foreground">
                      {t("common.language.comingSoon")}
                    </span>
                  ) : isActive ? (
                    <CheckIcon />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function LocaleFlag({ locale }: { locale: Locale }) {
  if (locale === "fr") {
    return (
      <span className="flex h-4 w-6 overflow-hidden rounded-[2px] border border-black/10">
        <span className="h-full w-1/3 bg-[#0055A4]" />
        <span className="h-full w-1/3 bg-white" />
        <span className="h-full w-1/3 bg-[#EF4135]" />
      </span>
    );
  }
  // English / Union Jack — simplified, no need for full vexillology.
  return (
    <span className="flex h-4 w-6 items-center justify-center overflow-hidden rounded-[2px] border border-black/10 bg-[#012169]">
      <span className="text-[8px] font-bold leading-none text-white">EN</span>
    </span>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 text-accent"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
