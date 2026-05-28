"use client";

import type { ComponentType, CSSProperties, SVGProps } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LockLineIcon,
  LogOutIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { NAV_GROUPS, NAV_SOLO_ITEMS, type NavItem } from "./nav-config";

/** True iff the item has no permission gate, or the user holds at least one. */
function itemAllowed(
  item: { permissions?: ReadonlyArray<string> },
  ownedPermissions: ReadonlyArray<string>,
): boolean {
  if (!item.permissions || item.permissions.length === 0) return true;
  return item.permissions.some((permission) =>
    ownedPermissions.includes(permission),
  );
}

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

/**
 * Dark sidebar matching interfaces.pdf p6/p8. Inline style values are used
 * for the dark palette so the build doesn't depend on Tailwind utilities
 * that may be tree-shaken in v4 when no other class references them.
 */
const PALETTE = {
  background: "#383838",
  hover: "rgba(255, 255, 255, 0.06)",
  divider: "rgba(255, 255, 255, 0.08)",
  whiteText: "#ffffff",
  mutedText: "rgba(255, 255, 255, 0.62)",
  dimText: "rgba(255, 255, 255, 0.45)",
  activeBar: "#ffffff",
};

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();

  // One open/closed flag per group. Auto-open any group containing the active
  // route on mount, then let the user toggle freely afterwards.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const group of NAV_GROUPS) {
      if (group.defaultExpanded) set.add(group.labelKey);
    }
    return set;
  });

  // When the route changes to an item inside a closed group, snap that group
  // open so the active item is visible. Existing user choices are preserved.
  useEffect(() => {
    setOpenGroups((current) => {
      let next = current;
      for (const group of NAV_GROUPS) {
        const hasActive = group.items.some(
          (item) =>
            item.available &&
            (pathname === item.href || pathname.startsWith(`${item.href}/`)),
        );
        if (hasActive && !next.has(group.labelKey)) {
          if (next === current) next = new Set(current);
          next.add(group.labelKey);
        }
      }
      return next;
    });
  }, [pathname]);

  function toggleGroup(labelKey: string) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(labelKey)) next.delete(labelKey);
      else next.add(labelKey);
      return next;
    });
  }

  async function handleSignOut() {
    await session.signOut();
    router.replace("/login");
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // Permission-gate everything against the session's union of role + direct
  // permissions. Items with no permission gate stay visible.
  const ownedPermissions =
    session.status === "authenticated" ? session.user.permissions ?? [] : [];
  const visibleSoloItems = NAV_SOLO_ITEMS.filter((item) =>
    itemAllowed(item, ownedPermissions),
  );
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => itemAllowed(item, ownedPermissions)),
  })).filter((group) => group.items.length > 0);

  return (
    <aside
      style={{ backgroundColor: PALETTE.background }}
      className={cn(
        "hidden md:flex md:shrink-0 md:flex-col",
        "transition-[width] duration-200 ease-out",
        collapsed ? "md:w-16" : "md:w-64",
      )}
      aria-label={t("common.brandName")}
    >
      <div
        className={cn(
          "flex h-16 items-center bg-background px-3",
          collapsed && "justify-center px-0",
        )}
        style={{ borderBottom: `1px solid ${PALETTE.divider}` }}
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

      <nav className="flex-1 overflow-y-auto py-3">
        {visibleSoloItems.map((item) => (
          <div key={item.href} className="px-2">
            <SoloLink
              item={item}
              icon={item.icon}
              active={isActive(item.href)}
              collapsed={collapsed}
              label={t(`shell.sidebar.items.${item.labelKey}`)}
            />
          </div>
        ))}

        {visibleGroups.map((group) => {
          const open = openGroups.has(group.labelKey);
          const hasActiveItem = group.items.some(
            (item) => item.available && isActive(item.href),
          );
          return (
            <NavGroup
              key={group.labelKey}
              labelKey={group.labelKey}
              label={t(`shell.sidebar.groups.${group.labelKey}`)}
              icon={group.icon}
              items={group.items}
              open={open}
              hasActiveItem={hasActiveItem}
              collapsed={collapsed}
              onToggle={() => toggleGroup(group.labelKey)}
              isActive={isActive}
              t={t}
            />
          );
        })}
      </nav>

      <div
        className={cn("p-2", collapsed && "px-0")}
        style={{ borderTop: `1px solid ${PALETTE.divider}` }}
      >
        <button
          type="button"
          onClick={handleSignOut}
          aria-label={t("shell.sidebar.signOut")}
          className={cn(
            "flex w-full items-center gap-3 rounded-[var(--radius-field)] px-3 py-2 text-sm font-semibold",
            "transition-colors duration-150",
            collapsed && "justify-center px-0",
          )}
          style={{ color: PALETTE.mutedText }}
          onMouseEnter={(event) => {
            event.currentTarget.style.backgroundColor = PALETTE.hover;
            event.currentTarget.style.color = PALETTE.whiteText;
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.backgroundColor = "transparent";
            event.currentTarget.style.color = PALETTE.mutedText;
          }}
        >
          <LogOutIcon className="h-5 w-5 shrink-0" />
          {!collapsed ? <span>{t("shell.sidebar.signOut")}</span> : null}
        </button>

        <button
          type="button"
          onClick={onToggle}
          aria-label={
            collapsed ? t("shell.sidebar.expand") : t("shell.sidebar.collapse")
          }
          className={cn(
            "mt-1 flex h-8 w-full items-center gap-2 rounded-[var(--radius-field)] px-3 text-[11px] font-semibold uppercase tracking-wider",
            "transition-colors duration-150",
            collapsed ? "justify-center px-0" : "justify-start",
          )}
          style={{ color: PALETTE.dimText }}
          onMouseEnter={(event) => {
            event.currentTarget.style.backgroundColor = PALETTE.hover;
            event.currentTarget.style.color = PALETTE.whiteText;
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.backgroundColor = "transparent";
            event.currentTarget.style.color = PALETTE.dimText;
          }}
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

type GroupProps = {
  labelKey: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  items: ReadonlyArray<NavItem>;
  open: boolean;
  hasActiveItem: boolean;
  collapsed: boolean;
  onToggle: () => void;
  isActive: (href: string) => boolean;
  t: (key: string) => string;
};

function NavGroup({
  label,
  icon: Icon,
  items,
  open,
  hasActiveItem,
  collapsed,
  onToggle,
  isActive,
  t,
}: GroupProps) {
  const headerColor =
    open || hasActiveItem ? PALETTE.whiteText : PALETTE.mutedText;
  const headerStyle: CSSProperties = { color: headerColor };

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        title={collapsed ? label : undefined}
        className={cn(
          "group flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold",
          "transition-colors duration-150",
          collapsed && "justify-center px-0",
        )}
        style={headerStyle}
        onMouseEnter={(event) =>
          (event.currentTarget.style.backgroundColor = PALETTE.hover)
        }
        onMouseLeave={(event) =>
          (event.currentTarget.style.backgroundColor = "transparent")
        }
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed ? (
          <>
            <span className="flex-1 truncate">{label}</span>
            {open ? (
              <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-70" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 shrink-0 opacity-70" />
            )}
          </>
        ) : null}
      </button>

      {open && !collapsed ? (
        <ul className="mb-1 flex flex-col">
          {items.map((item) => (
            <li key={item.href}>
              <SubLink
                item={item}
                active={item.available && isActive(item.href)}
                label={t(`shell.sidebar.items.${item.labelKey}`)}
                comingSoon={t("shell.sidebar.comingSoon")}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SoloLink({
  item,
  icon: Icon,
  active,
  collapsed,
  label,
}: {
  item: NavItem;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  active: boolean;
  collapsed: boolean;
  label: string;
}) {
  const baseClasses = cn(
    "group relative flex h-10 items-center gap-3 rounded-[var(--radius-field)] px-3 text-sm",
    "transition-colors duration-150",
    collapsed && "justify-center px-0",
  );
  const style: CSSProperties = {
    color: active ? PALETTE.whiteText : PALETTE.mutedText,
    fontWeight: active ? 600 : 500,
    backgroundColor: active ? PALETTE.hover : "transparent",
  };

  const content = (
    <>
      {active ? (
        <span
          aria-hidden
          className="absolute inset-y-1.5 left-0 w-[3px] rounded-full"
          style={{ backgroundColor: PALETTE.activeBar }}
        />
      ) : null}
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed ? <span className="flex-1 truncate">{label}</span> : null}
    </>
  );

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={baseClasses}
      style={style}
      onMouseEnter={(event) => {
        if (!active) {
          event.currentTarget.style.backgroundColor = PALETTE.hover;
          event.currentTarget.style.color = PALETTE.whiteText;
        }
      }}
      onMouseLeave={(event) => {
        if (!active) {
          event.currentTarget.style.backgroundColor = "transparent";
          event.currentTarget.style.color = PALETTE.mutedText;
        }
      }}
    >
      {content}
    </Link>
  );
}

function SubLink({
  item,
  active,
  label,
  comingSoon,
}: {
  item: NavItem;
  active: boolean;
  label: string;
  comingSoon: string;
}) {
  const baseClasses =
    "relative flex h-9 items-center pl-12 pr-4 text-sm transition-colors duration-150";

  const inactiveStyle: CSSProperties = {
    color: PALETTE.mutedText,
    fontWeight: 400,
  };
  const activeStyle: CSSProperties = {
    color: PALETTE.whiteText,
    fontWeight: 600,
  };
  const lockedStyle: CSSProperties = {
    color: PALETTE.dimText,
    fontWeight: 400,
    cursor: "not-allowed",
  };

  if (!item.available) {
    return (
      <span
        className={baseClasses}
        style={lockedStyle}
        aria-label={`${label} — ${comingSoon}`}
        title={comingSoon}
      >
        <span className="flex-1 truncate">{label}</span>
        <LockLineIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={baseClasses}
      style={active ? activeStyle : inactiveStyle}
      onMouseEnter={(event) => {
        if (!active) {
          event.currentTarget.style.backgroundColor = PALETTE.hover;
          event.currentTarget.style.color = PALETTE.whiteText;
        }
      }}
      onMouseLeave={(event) => {
        if (!active) {
          event.currentTarget.style.backgroundColor = "transparent";
          event.currentTarget.style.color = PALETTE.mutedText;
        }
      }}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute inset-y-1.5 left-0 w-[3px] rounded-full"
          style={{ backgroundColor: PALETTE.activeBar }}
        />
      ) : null}
      <span className="flex-1 truncate">{label}</span>
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
