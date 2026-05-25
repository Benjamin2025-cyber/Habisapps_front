"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ChevronLeftIcon, ChevronRightIcon, LockLineIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { NAV_GROUPS, type NavItem } from "./nav-config";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "hidden md:flex md:shrink-0 md:flex-col md:border-r md:border-border md:bg-background",
        "transition-[width] duration-200 ease-out",
        collapsed ? "md:w-16" : "md:w-64",
      )}
      aria-label={t("shell.sidebar.groups.main")}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-border px-3",
          collapsed && "justify-center px-0",
        )}
      >
        {collapsed ? (
          <Link href="/dashboard" aria-label={t("common.brandName")} className="block">
            <SmallBrand />
          </Link>
        ) : (
          <Link href="/dashboard" className="block w-full">
            <BrandLogo wordmarkClassName="text-xl" iconClassName="h-8 w-8" />
          </Link>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.labelKey ?? "ungrouped"} className="mb-4 last:mb-0">
            {!collapsed && group.labelKey ? (
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t(`shell.sidebar.groups.${group.labelKey}`)}
              </p>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <SidebarLink
                    item={item}
                    active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                    collapsed={collapsed}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label={
            collapsed ? t("shell.sidebar.expand") : t("shell.sidebar.collapse")
          }
          className={cn(
            "flex h-9 items-center gap-2 rounded-[var(--radius-field)] px-3 text-xs font-semibold text-muted-foreground",
            "hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            collapsed ? "w-full justify-center" : "w-full",
          )}
        >
          {collapsed ? (
            <ChevronRightIcon className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeftIcon className="h-4 w-4" />
              <span>{t("shell.sidebar.collapse")}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const t = useTranslations();
  const Icon = item.icon;
  const label = t(`shell.sidebar.items.${item.labelKey}`);

  const commonClasses = cn(
    "group relative flex h-9 items-center gap-3 rounded-[var(--radius-field)] px-3 text-sm",
    "transition-colors duration-150",
    active
      ? "bg-muted font-semibold text-foreground"
      : "text-foreground/70 hover:bg-muted hover:text-foreground",
    !item.available && "cursor-not-allowed opacity-60 hover:bg-transparent hover:text-foreground/70",
    collapsed && "justify-center px-0",
  );

  // Active items get the accent bar; locked items show a tooltip and don't navigate.
  const accent = active ? (
    <span
      aria-hidden
      className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-accent"
    />
  ) : null;

  const content = (
    <>
      {accent}
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed ? (
        <>
          <span className="flex-1 truncate">{label}</span>
          {!item.available ? (
            <LockLineIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : null}
        </>
      ) : null}
    </>
  );

  if (!item.available) {
    return (
      <span
        className={commonClasses}
        aria-label={`${label} — ${t("shell.sidebar.comingSoon")}`}
        title={t("shell.sidebar.comingSoon")}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={commonClasses}
    >
      {content}
    </Link>
  );
}

function SmallBrand() {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-field)] bg-primary text-primary-foreground">
      <span className="text-sm font-extrabold">H</span>
    </span>
  );
}
