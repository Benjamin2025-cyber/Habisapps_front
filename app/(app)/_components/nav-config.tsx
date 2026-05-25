import type { ComponentType, SVGProps } from "react";
import {
  BanknoteIcon,
  BellIcon,
  BookIcon,
  BuildingIcon,
  CalendarIcon,
  CashIcon,
  CheckCircleIcon,
  FileTextIcon,
  HomeIcon,
  PrinterIcon,
  SettingsIcon,
  ShieldIcon,
  UserIcon,
  UsersIcon,
} from "@/components/ui/icons";

export type NavItem = {
  /** Translation key under `shell.sidebar.items.*` (no namespace prefix). */
  labelKey: string;
  /** Concrete URL. For locked items, the href is still set so we can hover-preview but clicks are no-ops. */
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** False when the page hasn't been built yet — UI shows a padlock + "Bientôt disponible". */
  available: boolean;
};

export type NavGroup = {
  /** Translation key under `shell.sidebar.groups.*`. `null` skips the group label. */
  labelKey: string | null;
  items: NavItem[];
};

/**
 * Each entry is grouped exactly as DESIGN_PRINCIPLES.md §8.1 prescribes.
 * `available: false` means the page does not exist yet and will render with a
 * padlock. Flip to `true` as each implementation phase ships.
 */
export const NAV_GROUPS: ReadonlyArray<NavGroup> = [
  {
    labelKey: "main",
    items: [
      {
        labelKey: "dashboard",
        href: "/dashboard",
        icon: HomeIcon,
        available: true,
      },
    ],
  },
  {
    labelKey: "administration",
    items: [
      { labelKey: "users", href: "/admin/users", icon: UsersIcon, available: false },
      {
        labelKey: "agencies",
        href: "/admin/agencies",
        icon: BuildingIcon,
        available: false,
      },
      { labelKey: "roles", href: "/admin/roles", icon: ShieldIcon, available: false },
      {
        labelKey: "accountingDay",
        href: "/admin/accounting-day",
        icon: CalendarIcon,
        available: false,
      },
      { labelKey: "audit", href: "/admin/audit", icon: FileTextIcon, available: false },
    ],
  },
  {
    labelKey: "referentiel",
    items: [
      { labelKey: "clients", href: "/clients", icon: UserIcon, available: false },
      { labelKey: "accounts", href: "/accounts", icon: BookIcon, available: false },
      { labelKey: "guarantors", href: "/guarantors", icon: ShieldIcon, available: false },
      { labelKey: "proxies", href: "/proxies", icon: UsersIcon, available: false },
    ],
  },
  {
    labelKey: "credit",
    items: [
      {
        labelKey: "loanProducts",
        href: "/credit/loan-products",
        icon: BanknoteIcon,
        available: false,
      },
      { labelKey: "loans", href: "/credit/loans", icon: BanknoteIcon, available: false },
      {
        labelKey: "loanDisbursement",
        href: "/credit/disbursement",
        icon: CheckCircleIcon,
        available: false,
      },
      {
        labelKey: "collaterals",
        href: "/credit/collaterals",
        icon: ShieldIcon,
        available: false,
      },
      {
        labelKey: "loanTransfers",
        href: "/credit/transfers",
        icon: UsersIcon,
        available: false,
      },
      {
        labelKey: "delinquencies",
        href: "/credit/delinquencies",
        icon: BellIcon,
        available: false,
      },
    ],
  },
  {
    labelKey: "accounting",
    items: [
      {
        labelKey: "ledger",
        href: "/accounting/ledger",
        icon: BookIcon,
        available: false,
      },
      {
        labelKey: "sectors",
        href: "/accounting/sectors",
        icon: BookIcon,
        available: false,
      },
      {
        labelKey: "journalEntries",
        href: "/accounting/journal-entries",
        icon: FileTextIcon,
        available: false,
      },
      {
        labelKey: "ledgerJournal",
        href: "/accounting/journal",
        icon: FileTextIcon,
        available: false,
      },
    ],
  },
  {
    labelKey: "operations",
    items: [
      { labelKey: "tills", href: "/operations/tills", icon: CashIcon, available: false },
      {
        labelKey: "tellerSessions",
        href: "/operations/sessions",
        icon: CalendarIcon,
        available: false,
      },
      {
        labelKey: "tellerTransactions",
        href: "/operations/transactions",
        icon: BanknoteIcon,
        available: false,
      },
      {
        labelKey: "tellerInspection",
        href: "/operations/inspection",
        icon: FileTextIcon,
        available: false,
      },
    ],
  },
  {
    labelKey: "edition",
    items: [
      {
        labelKey: "reportsPar",
        href: "/reports/par",
        icon: PrinterIcon,
        available: false,
      },
      {
        labelKey: "reportsExigible",
        href: "/reports/exigible",
        icon: PrinterIcon,
        available: false,
      },
      {
        labelKey: "reportsRelease",
        href: "/reports/release",
        icon: PrinterIcon,
        available: false,
      },
      {
        labelKey: "reportsBalance",
        href: "/reports/balance",
        icon: PrinterIcon,
        available: false,
      },
    ],
  },
  {
    labelKey: "settings",
    items: [
      {
        labelKey: "denominations",
        href: "/settings/denominations",
        icon: CashIcon,
        available: false,
      },
      {
        labelKey: "batch",
        href: "/settings/batch",
        icon: SettingsIcon,
        available: false,
      },
    ],
  },
];

/**
 * Flat lookup used by breadcrumb derivation. Built lazily so the array isn't
 * recreated on every render.
 */
let flatCache: ReadonlyArray<NavItem> | null = null;

export function flatNavItems(): ReadonlyArray<NavItem> {
  if (flatCache) return flatCache;
  flatCache = NAV_GROUPS.flatMap((group) => group.items);
  return flatCache;
}
