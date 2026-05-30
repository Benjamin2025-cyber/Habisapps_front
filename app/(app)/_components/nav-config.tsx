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
  /**
   * Permission gate. Item is hidden unless the user holds at least one of the
   * listed permissions. `undefined` means visible to every authenticated user.
   * Use names defined in `HabisApi/config/security.php`.
   */
  permissions?: ReadonlyArray<string>;
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
 * dashboard is visible to every authenticated user — the page itself adapts
 * its content to the user's permissions.
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
 * Group order, labels, and items mirror interfaces.pdf p6/p8 exactly. Each
 * item carries the permission(s) that unlock it; see HabisApi
 * `config/security.php` for the canonical names.
 */
export const NAV_GROUPS: ReadonlyArray<NavGroup> = [
  {
    labelKey: "administration",
    icon: SettingsIcon,
    defaultExpanded: false,
    items: [
      {
        labelKey: "accountingDay",
        href: "/admin/accounting-day",
        available: false,
        permissions: ["accounting.audit.view"],
      },
      {
        labelKey: "users",
        href: "/admin/users",
        available: true,
        permissions: ["users.view"],
      },
      {
        labelKey: "roles",
        href: "/admin/roles",
        available: true,
        permissions: ["roles.view", "roles.manage"],
      },
      {
        labelKey: "audit",
        href: "/admin/audit",
        available: false,
        permissions: ["audit.view"],
      },
    ],
  },
  {
    labelKey: "database",
    icon: DatabaseIcon,
    defaultExpanded: false,
    items: [
      // Backups have no dedicated permission in security.php — gate behind a
      // platform-admin-only proxy. `system.view-health` is the closest match.
      {
        labelKey: "databaseBackups",
        href: "/database/backups",
        available: false,
        permissions: ["system.view-health"],
      },
    ],
  },
  {
    labelKey: "settings",
    icon: SlidersIcon,
    defaultExpanded: false,
    items: [
      {
        labelKey: "denominations",
        href: "/settings/denominations",
        available: false,
        permissions: ["cash.denominations.view"],
      },
      {
        labelKey: "batch",
        href: "/settings/batch",
        available: false,
        permissions: ["batch.procedures.view", "batch.procedures.manage"],
      },
    ],
  },
  {
    labelKey: "operations",
    icon: WorkflowIcon,
    defaultExpanded: false,
    items: [
      {
        labelKey: "tills",
        href: "/operations/tills",
        available: false,
        permissions: ["cash.tills.view"],
      },
      {
        labelKey: "tellerSessions",
        href: "/operations/sessions",
        available: false,
        permissions: ["cash.sessions.view"],
      },
      {
        labelKey: "tellerTransactions",
        href: "/operations/transactions",
        available: false,
        permissions: ["cash.transactions.view"],
      },
      {
        labelKey: "tellerInspection",
        href: "/operations/inspection",
        available: false,
        permissions: ["cash.sessions.view"],
      },
    ],
  },
  {
    labelKey: "referentiel",
    icon: BookIcon,
    defaultExpanded: true,
    items: [
      {
        labelKey: "agencies",
        href: "/admin/agencies",
        available: true,
        permissions: ["agencies.view"],
      },
      {
        labelKey: "managers",
        href: "/admin/managers",
        available: false,
        permissions: ["users.view"],
      },
      {
        labelKey: "clients",
        href: "/clients",
        available: true,
        permissions: ["crm.clients.view"],
      },
      {
        labelKey: "accounts",
        href: "/accounts",
        available: true,
        permissions: ["customer.accounts.view"],
      },
      {
        labelKey: "accountProducts",
        href: "/admin/account-products",
        available: true,
        permissions: ["account.products.view"],
      },
      {
        labelKey: "guarantors",
        href: "/guarantors",
        available: false,
        permissions: ["crm.guarantors.view"],
      },
      {
        labelKey: "proxies",
        href: "/proxies",
        available: false,
        permissions: ["crm.proxies.view"],
      },
    ],
  },
  {
    labelKey: "credit",
    icon: BanknoteIcon,
    defaultExpanded: true,
    items: [
      {
        labelKey: "loanProducts",
        href: "/credit/loan-products",
        available: true,
        permissions: ["loan.products.view"],
      },
      {
        labelKey: "loans",
        href: "/credit/loans",
        available: true,
        permissions: ["loans.view"],
      },
      {
        labelKey: "collaterals",
        href: "/credit/collaterals",
        available: true,
        permissions: ["loans.collaterals.manage", "loans.guarantees.manage"],
      },
      {
        labelKey: "loanDisbursement",
        href: "/credit/disbursement",
        available: false,
        permissions: ["loans.disburse"],
      },
      {
        labelKey: "loanDecision",
        href: "/credit/decision",
        available: false,
        permissions: [
          "loans.approvals.montage",
          "loans.approvals.comptabilite",
          "loans.approvals.controle",
          "loans.approvals.direction",
          "loans.status.transition",
        ],
      },
      {
        labelKey: "loanTransfers",
        href: "/credit/transfers",
        available: true,
        permissions: ["loans.transfers.manage"],
      },
      {
        labelKey: "delinquencies",
        href: "/credit/delinquencies",
        available: false,
        permissions: ["loans.delinquency.manage", "loans.recoveries.manage"],
      },
    ],
  },
  {
    labelKey: "accounting",
    icon: LayersIcon,
    defaultExpanded: true,
    items: [
      {
        labelKey: "globalClientImage",
        href: "/accounting/global-client-image",
        available: false,
        permissions: ["crm.clients.view"],
      },
    ],
  },
  {
    labelKey: "edition",
    icon: FileTextIcon,
    defaultExpanded: true,
    items: [
      {
        labelKey: "reportsPar",
        href: "/reports/par",
        available: false,
        permissions: ["loans.delinquency.manage", "ledger.accounts.view"],
      },
      {
        labelKey: "ledgerJournal",
        href: "/reports/journal",
        available: false,
        permissions: ["journal.entries.view"],
      },
      {
        labelKey: "cashDraft",
        href: "/reports/cash-draft",
        available: false,
        permissions: ["cash.reconciliations.view"],
      },
      {
        labelKey: "reportsExigible",
        href: "/reports/exigible",
        available: false,
        permissions: ["loans.delinquency.manage"],
      },
      {
        labelKey: "reportsRelease",
        href: "/reports/release",
        available: false,
        permissions: ["loans.collaterals.manage"],
      },
      {
        labelKey: "reportsBalance",
        href: "/reports/balance",
        available: false,
        permissions: ["ledger.accounts.view"],
      },
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
      permissions: item.permissions,
    })),
    ...NAV_GROUPS.flatMap((group) => group.items),
  ];
  return flatCache;
}
