"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/Badge";
import {
  fetchGuarantorsDirectory,
  type ClientGuarantor,
  type GuarantorStatus,
  type GuarantorVerificationStatus,
} from "@/lib/api/client-guarantors";
import { usePermissionGuard } from "@/lib/auth/usePermissionGuard";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { StakeholderDirectory } from "../_components/StakeholderDirectory";

const VERIFICATION_TONE: Record<
  GuarantorVerificationStatus,
  "neutral" | "info" | "success" | "danger"
> = {
  pending: "neutral",
  pending_review: "info",
  verified: "success",
  rejected: "danger",
};

const STATUS_VALUES: GuarantorStatus[] = ["active", "inactive", "archived"];
const VERIFICATION_VALUES: GuarantorVerificationStatus[] = [
  "pending",
  "pending_review",
  "verified",
  "rejected",
];

/** P8 — Référentiel Garants (vue transversale, lecture seule). Back-issue #13. */
export default function GuarantorsDirectoryPage() {
  const t = useTranslations();
  const session = useSession();
  const allowed = usePermissionGuard(["crm.guarantors.view"]);

  const columns = useMemo<ColumnDef<ClientGuarantor, unknown>[]>(
    () => [
      {
        accessorKey: "guarantor_full_name",
        header: t("directory.guarantors.columns.name"),
        cell: ({ getValue }) => (
          <span className="font-semibold text-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "guarantor_phone_number",
        header: t("directory.guarantors.columns.phone"),
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "relationship_type",
        header: t("directory.guarantors.columns.relationship"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "verification_status",
        header: t("directory.guarantors.columns.status"),
        cell: ({ row, getValue }) => {
          if (row.original.status === "archived") {
            return (
              <Badge tone="neutral">
                {t("clientDetail.guarantors.status.archived")}
              </Badge>
            );
          }
          const v = getValue() as GuarantorVerificationStatus;
          return (
            <Badge tone={VERIFICATION_TONE[v]}>
              {t(`clientDetail.guarantors.verificationStatus.${v}`)}
            </Badge>
          );
        },
      },
      {
        id: "client",
        header: t("directory.guarantors.columns.client"),
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
    label: t(`clientDetail.guarantors.status.${value}`),
  }));
  const verificationOptions = VERIFICATION_VALUES.map((value) => ({
    value,
    label: t(`clientDetail.guarantors.verificationStatus.${value}`),
  }));

  if (session.status !== "authenticated" || !allowed) return null;

  return (
    <StakeholderDirectory<ClientGuarantor>
      title={t("directory.guarantors.pageTitle")}
      description={t("directory.guarantors.pageDescription")}
      columns={columns}
      load={(token, q) =>
        fetchGuarantorsDirectory(token, {
          ...q,
          status: q.status as GuarantorStatus | undefined,
          verificationStatus: q.verificationStatus as
            | GuarantorVerificationStatus
            | undefined,
        })
      }
      getRowId={(row) => row.public_id}
      statusOptions={statusOptions}
      verificationOptions={verificationOptions}
    />
  );
}
