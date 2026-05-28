import type { ComponentType, SVGProps } from "react";
import {
  BanknoteIcon,
  BookIcon,
  DatabaseIcon,
  FileTextIcon,
  HomeIcon,
  LayersIcon,
  SettingsIcon,
  SlidersIcon,
  WorkflowIcon,
} from "@/components/ui/icons";

export type NavItem = {
  /** Translation key under `shell.sidebar.items.*` (no namespace prefix). */
  labelKey: string;
  /** Concrete URL. Locked items keep their href for hover-preview but never navigate. */
  href: string;
  /** False when the page hasn't been built yet — UI shows a padlock + "Bientôt disponible". */
  available: boolean;
};

export type NavGroup = {
  /** Translation key under `shell.sidebar.groups.*`. */
  labelKey: string;
  /** Icon shown in the collapsible group header. */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Whether the group is expanded the first time the sidebar mounts. */
  defaultExpanded: boolean;
  items: NavItem[];
};

/**
 * Solo links that sit above the grouped navigation (no group header). The
 * dashboard isn't shown in the PDF sidebar (the maquette assumes the user
 * navigates back via the logo) but we keep it surfaced for now so there's a
 * clear way home until the topbar carries that affordance.
 */
export const NAV_SOLO_ITEMS: ReadonlyArray<NavItem & { icon: ComponentType<SVGProps<SVGSVGElement>> }> = [
  {
    labelKey: "dashboard",
    href: "/dashboard",
    icon: HomeIcon,
    available: true,
  },
];

/**
 * Group order, labels, and items mirror interfaces.pdf p6/p8 exactly:
 * Administration → Base de donnée → Paramétrage → Opérations courantes →
 * Référentiel → Crédit → Comptabilité → Édition. Items inside groups that
 * are collapsed in the PDF are our best mapping of existing entities to the
 * group's role.
 */
export const NAV_GROUPS: ReadonlyArray<NavGroup> = [
  {
    labelKey: "administration",
    icon: SettingsIcon,
    defaultExpanded: false,
    items: [
      { labelKey: "accountingDay", href: "/admin/accounting-day", available: false },
      { labelKey: "users", href: "/admin/users", available: false },
      { labelKey: "roles", href: "/admin/roles", available: false },
      { labelKey: "audit", href: "/admin/audit", available: false },
    ],
  },
  {
    labelKey: "database",
    icon: DatabaseIcon,
    defaultExpanded: false,
    items: [
      { labelKey: "databaseBackups", href: "/database/backups", available: false },
    ],
  },
  {
    labelKey: "settings",
    icon: SlidersIcon,
    defaultExpanded: false,
    items: [
      { labelKey: "denominations", href: "/settings/denominations", available: false },
      { labelKey: "batch", href: "/settings/batch", available: false },
    ],
  },
  {
    labelKey: "operations",
    icon: WorkflowIcon,
    defaultExpanded: false,
    items: [
      { labelKey: "tills", href: "/operations/tills", available: false },
      { labelKey: "tellerSessions", href: "/operations/sessions", available: false },
      { labelKey: "tellerTransactions", href: "/operations/transactions", available: false },
      { labelKey: "tellerInspection", href: "/operations/inspection", available: false },
    ],
  },
  {
    labelKey: "referentiel",
    icon: BookIcon,
    defaultExpanded: true,
    items: [
      { labelKey: "agencies", href: "/admin/agencies", available: true },
      { labelKey: "managers", href: "/admin/managers", available: false },
      { labelKey: "clients", href: "/clients", available: false },
      { labelKey: "accounts", href: "/accounts", available: false },
      { labelKey: "guarantors", href: "/guarantors", available: false },
      { labelKey: "proxies", href: "/proxies", available: false },
    ],
  },
  {
    labelKey: "credit",
    icon: BanknoteIcon,
    defaultExpanded: true,
    items: [
      { labelKey: "loans", href: "/credit/loans", available: false },
      { labelKey: "collaterals", href: "/credit/collaterals", available: false },
      { labelKey: "loanDisbursement", href: "/credit/disbursement", available: false },
      { labelKey: "loanDecision", href: "/credit/decision", available: false },
      { labelKey: "loanTransfers", href: "/credit/transfers", available: false },
      { labelKey: "delinquencies", href: "/credit/delinquencies", available: false },
    ],
  },
  {
    labelKey: "accounting",
    icon: LayersIcon,
    defaultExpanded: true,
    items: [
      { labelKey: "globalClientImage", href: "/accounting/global-client-image", available: false },
    ],
  },
  {
    labelKey: "edition",
    icon: FileTextIcon,
    defaultExpanded: true,
    items: [
      { labelKey: "reportsPar", href: "/reports/par", available: false },
      { labelKey: "ledgerJournal", href: "/reports/journal", available: false },
      { labelKey: "cashDraft", href: "/reports/cash-draft", available: false },
      { labelKey: "reportsExigible", href: "/reports/exigible", available: false },
      { labelKey: "reportsRelease", href: "/reports/release", available: false },
      { labelKey: "reportsBalance", href: "/reports/balance", available: false },
    ],
  },
];

/**
 * Flat lookup used by breadcrumb derivation. Includes both solo items and
 * group items. Built lazily so the array isn't recreated on every render.
 */
let flatCache: ReadonlyArray<NavItem> | null = null;

export function flatNavItems(): ReadonlyArray<NavItem> {
  if (flatCache) return flatCache;
  flatCache = [
    ...NAV_SOLO_ITEMS.map((item) => ({
      labelKey: item.labelKey,
      href: item.href,
      available: item.available,
    })),
    ...NAV_GROUPS.flatMap((group) => group.items),
  ];
  return flatCache;
}
