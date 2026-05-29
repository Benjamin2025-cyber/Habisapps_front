"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataTablePagination } from "@/components/ui/DataTable";
import {
  DropdownMenu,
  type DropdownMenuItem,
} from "@/components/ui/DropdownMenu";
import { MoreVerticalIcon } from "@/components/ui/icons";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type {
  Client,
  ClientKycStatus,
  ClientStatus,
  KycAction,
} from "@/lib/api/clients";

type Props = {
  rows: ReadonlyArray<Client>;
  loading: boolean;
  pagination?: DataTablePagination;
  /** Permissions for row actions. Items hidden when flag is false. */
  canEdit: boolean;
  canChangeStatus: boolean;
  canSubmitKyc: boolean;
  canReviewKyc: boolean;
  onEdit: (client: Client) => void;
  onChangeStatus: (client: Client, next: ClientStatus) => void;
  onKycAction: (client: Client, action: KycAction) => void;
};

const STATUS_TONE: Record<
  ClientStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  active: "success",
  inactive: "neutral",
  suspended: "warning",
  archived: "danger",
};

const KYC_TONE: Record<
  ClientKycStatus,
  "neutral" | "info" | "success" | "danger" | "warning"
> = {
  draft: "neutral",
  pending_review: "info",
  verified: "success",
  rejected: "danger",
  suspended: "warning",
  archived: "neutral",
};

export function ClientsTable({
  rows,
  loading,
  pagination,
  canEdit,
  canChangeStatus,
  canSubmitKyc,
  canReviewKyc,
  onEdit,
  onChangeStatus,
  onKycAction,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const hasAnyAction =
    canEdit || canChangeStatus || canSubmitKyc || canReviewKyc;

  const columns = useMemo<ColumnDef<Client, unknown>[]>(
    () => [
      {
        accessorKey: "client_reference",
        header: t("clients.columns.reference"),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          return (
            <span className="text-base font-bold tabular-nums text-foreground">
              {value ?? "—"}
            </span>
          );
        },
      },
      {
        id: "fullName",
        header: t("clients.columns.fullName"),
        cell: ({ row }) => {
          const client = row.original;
          const parts = [
            client.last_name?.toUpperCase(),
            client.first_name,
            client.middle_name,
          ].filter((value): value is string => !!value && value.length > 0);
          return (
            <span className="text-foreground">
              {parts.length === 0 ? "—" : parts.join(" ")}
            </span>
          );
        },
      },
      {
        accessorKey: "phone_number",
        header: t("clients.columns.phone"),
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "email",
        header: t("clients.columns.email"),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          return value ? (
            <span className="text-muted-foreground">{value}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        accessorKey: "gender",
        header: t("clients.columns.gender"),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          if (!value) return <span className="text-muted-foreground">—</span>;
          const key = `clients.gender.${value.toLowerCase()}`;
          const label = t(key);
          return (
            <span className="text-muted-foreground">
              {label === key ? value : label}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("clients.columns.status"),
        cell: ({ getValue }) => {
          const status = getValue() as ClientStatus;
          return (
            <Badge tone={STATUS_TONE[status]}>
              {t(`clients.status.${status}`)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "kyc_status",
        header: t("clients.columns.kyc"),
        cell: ({ getValue }) => {
          const status = getValue() as ClientKycStatus;
          return (
            <Badge tone={KYC_TONE[status]}>
              {t(`clients.kyc.${status}`)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "onboarded_on",
        header: t("clients.columns.onboardedOn"),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          if (!value) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="tabular-nums text-muted-foreground">
              {value.slice(0, 10)}
            </span>
          );
        },
      },
      ...(hasAnyAction
        ? [
            {
              id: "actions",
              header: t("clients.columns.actions"),
              meta: { align: "right" },
              cell: ({ row }) => {
                const client = row.original;
                const items: DropdownMenuItem[] = [];
                if (canEdit) {
                  items.push({
                    label: t("clients.actions.edit"),
                    onClick: () => onEdit(client),
                  });
                }
                if (canSubmitKyc && client.kyc_status === "draft") {
                  items.push({
                    label: t("clients.actions.kycSubmit"),
                    onClick: () => onKycAction(client, "submit"),
                  });
                }
                if (canReviewKyc && client.kyc_status === "pending_review") {
                  items.push({
                    label: t("clients.actions.kycVerify"),
                    onClick: () => onKycAction(client, "verify"),
                  });
                  items.push({
                    label: t("clients.actions.kycReject"),
                    onClick: () => onKycAction(client, "reject"),
                    destructive: true,
                  });
                }
                if (
                  canReviewKyc &&
                  (client.kyc_status === "verified" ||
                    client.kyc_status === "rejected")
                ) {
                  items.push({
                    label: t("clients.actions.kycSuspend"),
                    onClick: () => onKycAction(client, "suspend"),
                  });
                }
                if (canChangeStatus) {
                  if (items.length > 0) items.push({ kind: "separator" });
                  items.push({
                    kind: "label",
                    label: t("clients.actions.changeStatus"),
                  });
                  items.push({
                    label: t("clients.actions.statusActive"),
                    onClick: () => onChangeStatus(client, "active"),
                    disabled: client.status === "active",
                  });
                  items.push({
                    label: t("clients.actions.statusInactive"),
                    onClick: () => onChangeStatus(client, "inactive"),
                    disabled: client.status === "inactive",
                  });
                  items.push({
                    label: t("clients.actions.statusSuspended"),
                    onClick: () => onChangeStatus(client, "suspended"),
                    disabled: client.status === "suspended",
                  });
                  items.push({
                    label: t("clients.actions.statusArchived"),
                    onClick: () => onChangeStatus(client, "archived"),
                    disabled: client.status === "archived",
                    destructive: true,
                  });
                }
                if (items.length === 0) return null;
                return (
                  <div
                    className="flex justify-end"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <DropdownMenu
                      trigger={<MoreVerticalIcon className="h-4 w-4" />}
                      triggerLabel={t("clients.actions.menu")}
                      items={items}
                      align="right"
                    />
                  </div>
                );
              },
            } satisfies ColumnDef<Client, unknown>,
          ]
        : []),
    ],
    [
      t,
      hasAnyAction,
      canEdit,
      canChangeStatus,
      canSubmitKyc,
      canReviewKyc,
      onEdit,
      onChangeStatus,
      onKycAction,
    ],
  );

  return (
    <DataTable<Client>
      columns={columns}
      data={rows as Client[]}
      loading={loading}
      emptyMessage={t("clients.list.empty")}
      getRowId={(row) => row.public_id}
      pagination={pagination}
      title={t("clients.list.titleHeader")}
      titleAside={t("clients.list.count", {
        count: pagination?.total ?? rows.length,
      })}
      bottomCaption={t("clients.list.totalCaption", {
        count: pagination?.total ?? rows.length,
      })}
      onRowClick={(row) => router.push(`/clients/${row.public_id}`)}
    />
  );
}
