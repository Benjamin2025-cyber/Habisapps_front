"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/Badge";
import {
  fetchProxiesDirectory,
  type ClientProxy,
  type ProxyStatus,
  type ProxyVerificationStatus,
} from "@/lib/api/client-proxies";
import { usePermissionGuard } from "@/lib/auth/usePermissionGuard";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { StakeholderDirectory } from "../_components/StakeholderDirectory";

const VERIFICATION_TONE: Record<
  ProxyVerificationStatus,
  "neutral" | "info" | "success" | "danger"
> = {
  pending: "neutral",
  pending_review: "info",
  verified: "success",
  rejected: "danger",
};

const STATUS_VALUES: ProxyStatus[] = [
  "active",
  "inactive",
  "expired",
  "archived",
];
const VERIFICATION_VALUES: ProxyVerificationStatus[] = [
  "pending",
  "pending_review",
  "verified",
  "rejected",
];

/** P9 — Référentiel Mandataires (vue transversale, lecture seule). Back-issue #13. */
export default function ProxiesDirectoryPage() {
  const t = useTranslations();
  const session = useSession();
  const allowed = usePermissionGuard(["crm.proxies.view"]);

  const columns = useMemo<ColumnDef<ClientProxy, unknown>[]>(
    () => [
      {
        accessorKey: "proxy_full_name",
        header: t("directory.proxies.columns.name"),
        cell: ({ getValue }) => (
          <span className="font-semibold text-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "proxy_phone_number",
        header: t("directory.proxies.columns.phone"),
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "mandate_type",
        header: t("directory.proxies.columns.mandate"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "verification_status",
        header: t("directory.proxies.columns.status"),
        cell: ({ row, getValue }) => {
          if (row.original.status === "archived") {
            return (
              <Badge tone="neutral">
                {t("clientDetail.proxies.status.archived")}
              </Badge>
            );
          }
          const v = getValue() as ProxyVerificationStatus;
          return (
            <Badge tone={VERIFICATION_TONE[v]}>
              {t(`clientDetail.proxies.verificationStatus.${v}`)}
            </Badge>
          );
        },
      },
      {
        id: "client",
        header: t("directory.proxies.columns.client"),
        meta: { align: "right" },
        cell: ({ row }) => {
          const id = row.original.client_public_id;
          if (!id) return <span className="text-muted-foreground">—</span>;
          return (
            <Link
              href={`/clients/${id}`}
              className="text-xs font-semibold text-accent hover:underline"
            >
              {t("directory.openClient")}
            </Link>
          );
        },
      },
    ],
    [t],
  );

  const statusOptions = STATUS_VALUES.map((value) => ({
    value,
    label: t(`clientDetail.proxies.status.${value}`),
  }));
  const verificationOptions = VERIFICATION_VALUES.map((value) => ({
    value,
    label: t(`clientDetail.proxies.verificationStatus.${value}`),
  }));

  if (session.status !== "authenticated" || !allowed) return null;

  return (
    <StakeholderDirectory<ClientProxy>
      title={t("directory.proxies.pageTitle")}
      description={t("directory.proxies.pageDescription")}
      columns={columns}
      load={(token, q) =>
        fetchProxiesDirectory(token, {
          ...q,
          status: q.status as ProxyStatus | undefined,
          verificationStatus: q.verificationStatus as
            | ProxyVerificationStatus
            | undefined,
        })
      }
      getRowId={(row) => row.public_id}
      statusOptions={statusOptions}
      verificationOptions={verificationOptions}
    />
  );
}
