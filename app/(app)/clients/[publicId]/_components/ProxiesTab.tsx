"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import {
  DropdownMenu,
  type DropdownMenuItem,
} from "@/components/ui/DropdownMenu";
import { MoreVerticalIcon } from "@/components/ui/icons";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/ui/TextField";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import {
  createProxy,
  fetchProxies,
  updateProxy,
  updateProxyStatus,
  type ClientProxy,
  type ProxyAction,
  type ProxyStatus,
  type ProxyWritePayload,
} from "@/lib/api/client-proxies";
import { localizeApiError } from "@/lib/api/errors";
import { SubResourceActionDrawer } from "./SubResourceActionDrawer";

type Props = {
  clientPublicId: string;
  onCountChange?: (count: number) => void;
};

const STATUS_TONE: Record<
  ProxyStatus,
  "neutral" | "info" | "success" | "danger" | "warning"
> = {
  draft: "neutral",
  pending_review: "info",
  verified: "success",
  rejected: "danger",
  deactivated: "warning",
  expired: "warning",
  archived: "neutral",
};

export function ProxiesTab({ clientPublicId, onCountChange }: Props) {
  const t = useTranslations();
  const session = useSession();
  const toast = useToast();

  const canCreate = useCan("crm.proxies.create");
  const canEdit = useCan("crm.proxies.update");
  const canSubmit = useCan("crm.proxies.create");
  const canVerify = useCan("crm.proxies.verify");
  const canReject = useCan("crm.proxies.reject");
  const canArchive = useCan("crm.proxies.archive");
  const canExpire = useCan("crm.proxies.expire");

  const token = session.status === "authenticated" ? session.token : null;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ClientProxy | null>(null);
  const [actionDrawer, setActionDrawer] = useState<{
    row: ClientProxy;
    action: ProxyAction;
  } | null>(null);

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<ClientProxy[]> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchProxies(token, clientPublicId);
    },
    [token, clientPublicId],
  );

  const { data, loading, refetch } = useApi(fetcher, [token, clientPublicId]);

  useEffect(() => {
    if (data) onCountChange?.(data.length);
  }, [data, onCountChange]);

  async function handleSubmit(payload: ProxyWritePayload) {
    if (!token) return;
    if (editing) {
      await updateProxy(token, clientPublicId, editing.public_id, payload);
      toast.success(
        t("clientDetail.proxies.toast.updatedTitle"),
        t("clientDetail.proxies.toast.updatedBody"),
      );
    } else {
      await createProxy(token, clientPublicId, payload);
      toast.success(
        t("clientDetail.proxies.toast.createdTitle"),
        t("clientDetail.proxies.toast.createdBody"),
      );
    }
    setDrawerOpen(false);
    setEditing(null);
    refetch();
  }

  async function handleAction(payload: {
    action: ProxyAction;
    reason: string | null;
    comment: string | null;
  }) {
    if (!token || !actionDrawer) return;
    await updateProxyStatus(
      token,
      clientPublicId,
      actionDrawer.row.public_id,
      payload,
    );
    toast.success(
      t("clientDetail.proxies.toast.statusChangedTitle"),
      t("clientDetail.proxies.toast.statusChangedBody", {
        action: t(`clientDetail.proxies.action.title.${payload.action}`),
      }),
    );
    setActionDrawer(null);
    refetch();
  }

  const columns = useMemo<ColumnDef<ClientProxy, unknown>[]>(
    () => [
      {
        accessorKey: "proxy_full_name",
        header: t("clientDetail.proxies.columns.name"),
        cell: ({ getValue }) => (
          <span className="font-semibold text-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "mandate_type",
        header: t("clientDetail.proxies.columns.mandate"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{String(getValue() ?? "—")}</span>
        ),
      },
      {
        accessorKey: "proxy_phone_number",
        header: t("clientDetail.proxies.columns.phone"),
        cell: ({ getValue }) => (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "starts_on",
        header: t("clientDetail.proxies.columns.startsOn"),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          return value ? (
            <span className="tabular-nums text-muted-foreground">{value.slice(0, 10)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        accessorKey: "ends_on",
        header: t("clientDetail.proxies.columns.endsOn"),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          return value ? (
            <span className="tabular-nums text-muted-foreground">{value.slice(0, 10)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("clientDetail.proxies.columns.status"),
        cell: ({ getValue }) => {
          const status = getValue() as ProxyStatus;
          return (
            <Badge tone={STATUS_TONE[status]}>
              {t(`clientDetail.proxies.status.${status}`)}
            </Badge>
          );
        },
      },
      ...(canEdit || canSubmit || canVerify || canReject || canArchive || canExpire
        ? [
            {
              id: "actions",
              header: t("clientDetail.proxies.columns.actions"),
              meta: { align: "right" },
              cell: ({ row }) => {
                const rec = row.original;
                const items: DropdownMenuItem[] = [];
                if (canEdit && (rec.status === "draft" || rec.status === "rejected")) {
                  items.push({
                    label: t("clientDetail.proxies.actions.edit"),
                    onClick: () => {
                      setEditing(rec);
                      setDrawerOpen(true);
                    },
                  });
                }
                if (canSubmit && rec.status === "draft") {
                  items.push({
                    label: t("clientDetail.proxies.actions.submit"),
                    onClick: () => setActionDrawer({ row: rec, action: "submit" }),
                  });
                }
                if (canVerify && rec.status === "pending_review") {
                  items.push({
                    label: t("clientDetail.proxies.actions.verify"),
                    onClick: () => setActionDrawer({ row: rec, action: "verify" }),
                  });
                }
                if (canReject && rec.status === "pending_review") {
                  items.push({
                    label: t("clientDetail.proxies.actions.reject"),
                    onClick: () => setActionDrawer({ row: rec, action: "reject" }),
                    destructive: true,
                  });
                }
                if (canExpire && rec.status === "verified") {
                  items.push({
                    label: t("clientDetail.proxies.actions.expire"),
                    onClick: () => setActionDrawer({ row: rec, action: "expire" }),
                  });
                }
                if (canArchive && rec.status === "verified") {
                  items.push({
                    label: t("clientDetail.proxies.actions.deactivate"),
                    onClick: () => setActionDrawer({ row: rec, action: "deactivate" }),
                  });
                }
                if (canArchive && rec.status !== "archived") {
                  if (items.length > 0) items.push({ kind: "separator" });
                  items.push({
                    label: t("clientDetail.proxies.actions.archive"),
                    onClick: () => setActionDrawer({ row: rec, action: "archive" }),
                    destructive: true,
                  });
                }
                if (items.length === 0) return null;
                return (
                  <div className="flex justify-end">
                    <DropdownMenu
                      trigger={<MoreVerticalIcon className="h-4 w-4" />}
                      triggerLabel={t("clientDetail.proxies.actions.menu")}
                      items={items}
                      align="right"
                    />
                  </div>
                );
              },
            } satisfies ColumnDef<ClientProxy, unknown>,
          ]
        : []),
    ],
    [t, canEdit, canSubmit, canVerify, canReject, canArchive, canExpire],
  );

  return (
    <div className="flex flex-col gap-4">
      <DataTable<ClientProxy>
        columns={columns}
        data={data ?? []}
        loading={loading && !data}
        emptyMessage={t("clientDetail.proxies.empty")}
        getRowId={(row) => row.public_id}
        title={t("clientDetail.proxies.title")}
        titleAside={t("clientDetail.proxies.count", { count: data?.length ?? 0 })}
      />

      {canCreate ? (
        <div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditing(null);
              setDrawerOpen(true);
            }}
          >
            + {t("clientDetail.proxies.actions.create")}
          </Button>
        </div>
      ) : null}

      <ProxyDrawer
        open={drawerOpen}
        editing={editing}
        onClose={() => {
          setDrawerOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />

      <SubResourceActionDrawer
        open={actionDrawer !== null}
        action={actionDrawer?.action ?? null}
        targetLabel={actionDrawer?.row.proxy_full_name ?? ""}
        i18nNamespace="clientDetail.proxies"
        onClose={() => setActionDrawer(null)}
        onSubmit={handleAction}
      />
    </div>
  );
}

function ProxyDrawer({
  open,
  editing,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: ClientProxy | null;
  onClose: () => void;
  onSubmit: (payload: ProxyWritePayload) => Promise<void>;
}) {
  const t = useTranslations();
  const [form, setForm] = useState({
    proxy_full_name: "",
    proxy_phone_number: "",
    proxy_email: "",
    proxy_id_document_type: "",
    proxy_id_document_number: "",
    mandate_type: "",
    starts_on: "",
    ends_on: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setGeneralError(null);
    if (editing) {
      setForm({
        proxy_full_name: editing.proxy_full_name ?? "",
        proxy_phone_number: editing.proxy_phone_number ?? "",
        proxy_email: editing.proxy_email ?? "",
        proxy_id_document_type: editing.proxy_id_document_type ?? "",
        proxy_id_document_number: editing.proxy_id_document_number ?? "",
        mandate_type: editing.mandate_type ?? "",
        starts_on: editing.starts_on ? editing.starts_on.slice(0, 10) : "",
        ends_on: editing.ends_on ? editing.ends_on.slice(0, 10) : "",
      });
    } else {
      setForm({
        proxy_full_name: "",
        proxy_phone_number: "",
        proxy_email: "",
        proxy_id_document_type: "",
        proxy_id_document_number: "",
        mandate_type: "",
        starts_on: "",
        ends_on: "",
      });
    }
  }, [open, editing]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);
    try {
      await onSubmit({
        proxy_full_name: form.proxy_full_name.trim(),
        proxy_phone_number: nullable(form.proxy_phone_number),
        proxy_email: nullable(form.proxy_email),
        proxy_id_document_type: nullable(form.proxy_id_document_type),
        proxy_id_document_number: nullable(form.proxy_id_document_number),
        mandate_type: form.mandate_type.trim(),
        starts_on: nullable(form.starts_on),
        ends_on: nullable(form.ends_on),
      });
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        proxy_full_name: t("clientDetail.proxies.fields.name"),
        proxy_phone_number: t("clientDetail.proxies.fields.phone"),
        proxy_email: t("clientDetail.proxies.fields.email"),
        proxy_id_document_type: t("clientDetail.proxies.fields.idType"),
        proxy_id_document_number: t("clientDetail.proxies.fields.idNumber"),
        mandate_type: t("clientDetail.proxies.fields.mandateType"),
        starts_on: t("clientDetail.proxies.fields.startsOn"),
        ends_on: t("clientDetail.proxies.fields.endsOn"),
      });
      setErrors(fieldErrors);
      setGeneralError(generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={
        editing
          ? t("clientDetail.proxies.drawer.titleEdit")
          : t("clientDetail.proxies.drawer.titleCreate")
      }
      description={t("clientDetail.proxies.drawer.hint")}
      widthClassName="sm:w-[34rem]"
      footer={
        <>
          <Button variant="ghost" size="md" type="button" onClick={onClose} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            form="proxy-form"
            disabled={submitting}
          >
            {submitting ? t("common.loading") : t("common.save")}
          </Button>
        </>
      }
    >
      {generalError ? (
        <p className="mb-4 rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
          {generalError}
        </p>
      ) : null}
      <form id="proxy-form" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label={t("clientDetail.proxies.fields.name")}
          value={form.proxy_full_name}
          onChange={(event) => setForm((c) => ({ ...c, proxy_full_name: event.target.value }))}
          error={errors.proxy_full_name}
          required
        />
        <TextField
          label={t("clientDetail.proxies.fields.mandateType")}
          value={form.mandate_type}
          onChange={(event) => setForm((c) => ({ ...c, mandate_type: event.target.value }))}
          error={errors.mandate_type}
          required
          hint={t("clientDetail.proxies.fields.mandateTypeHint")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label={t("clientDetail.proxies.fields.phone")}
            type="tel"
            value={form.proxy_phone_number}
            onChange={(event) =>
              setForm((c) => ({ ...c, proxy_phone_number: event.target.value }))
            }
            error={errors.proxy_phone_number}
          />
          <TextField
            label={t("clientDetail.proxies.fields.email")}
            type="email"
            value={form.proxy_email}
            onChange={(event) => setForm((c) => ({ ...c, proxy_email: event.target.value }))}
            error={errors.proxy_email}
          />
          <TextField
            label={t("clientDetail.proxies.fields.idType")}
            value={form.proxy_id_document_type}
            onChange={(event) =>
              setForm((c) => ({ ...c, proxy_id_document_type: event.target.value }))
            }
            error={errors.proxy_id_document_type}
          />
          <TextField
            label={t("clientDetail.proxies.fields.idNumber")}
            value={form.proxy_id_document_number}
            onChange={(event) =>
              setForm((c) => ({ ...c, proxy_id_document_number: event.target.value }))
            }
            error={errors.proxy_id_document_number}
          />
          <TextField
            label={t("clientDetail.proxies.fields.startsOn")}
            type="date"
            value={form.starts_on}
            onChange={(event) => setForm((c) => ({ ...c, starts_on: event.target.value }))}
            error={errors.starts_on}
          />
          <TextField
            label={t("clientDetail.proxies.fields.endsOn")}
            type="date"
            value={form.ends_on}
            onChange={(event) => setForm((c) => ({ ...c, ends_on: event.target.value }))}
            error={errors.ends_on}
          />
        </div>
      </form>
    </Drawer>
  );
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
