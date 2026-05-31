"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTablePagination } from "@/components/ui/DataTable";
import {
  DropdownMenu,
  type DropdownMenuItem,
} from "@/components/ui/DropdownMenu";
import { Drawer } from "@/components/ui/Drawer";
import { MoreVerticalIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { MoneyField } from "@/components/ui/MoneyField";
import {
  createDenomination,
  fetchDenominations,
  updateDenomination,
  type Denomination,
  type DenominationStatus,
  type DenominationType,
  type DenominationWritePayload,
  type PaginatedDenominations,
} from "@/lib/api/denominations";
import { localizeApiError, localizeApiMessage } from "@/lib/api/errors";
import { useCanAny, useHasRole } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/SessionProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useFormatter, useTranslations } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { PageHeader } from "../../_components/PageHeader";

/** P25 — Paramétrage › Type monnaie (coupures). CRUD sans suppression. */
export default function DenominationsPage() {
  const t = useTranslations();
  const format = useFormatter();
  const session = useSession();
  const toast = useToast();
  const token = session.status === "authenticated" ? session.token : null;

  const isPlatformAdmin = useHasRole(["platform-admin"]);
  const viewPerm = useCanAny(["cash.denominations.view"]);
  const managePerm = useCanAny(["cash.denominations.manage"]);
  const canView = isPlatformAdmin || viewPerm;
  const canManage = isPlatformAdmin || managePerm;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [drawer, setDrawer] = useState<{ mode: "create" | "edit"; initial: Denomination | null } | null>(null);

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PaginatedDenominations> => {
      if (!token) throw new Error("Missing session token");
      void signal;
      return fetchDenominations(token, { page, perPage: pageSize });
    },
    [token, page, pageSize],
  );
  const { data, loading, error, refetch } = useApi(fetcher, [token, page, pageSize]);

  const rows = useMemo(
    () => [...(data?.data ?? [])].sort((a, b) => b.value_minor - a.value_minor),
    [data],
  );

  async function handleSetStatus(d: Denomination, status: DenominationStatus) {
    if (!token) return;
    try {
      await updateDenomination(token, d.public_id, { status });
      toast.success(t("denominations.toast.statusTitle"), t("denominations.toast.statusBody", { label: d.label, status: t(`denominations.status.${status}`) }));
      refetch();
    } catch (cause) {
      toast.error(t("denominations.toast.errorTitle"), localizeApiError(cause).generalMessage);
    }
  }

  async function handleSubmit(payload: DenominationWritePayload) {
    if (!token || !drawer) return;
    if (drawer.mode === "create") {
      const created = await createDenomination(token, payload);
      toast.success(t("denominations.toast.createdTitle"), t("denominations.toast.createdBody", { label: created.label }));
      setPage(1);
    } else if (drawer.initial) {
      await updateDenomination(token, drawer.initial.public_id, payload);
      toast.success(t("denominations.toast.updatedTitle"), t("denominations.toast.updatedBody", { label: drawer.initial.label }));
    }
    setDrawer(null);
    refetch();
  }

  const columns = useMemo<ColumnDef<Denomination, unknown>[]>(
    () => [
      {
        accessorKey: "label",
        header: t("denominations.columns.label"),
        cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue() as string}</span>,
      },
      {
        accessorKey: "value_minor",
        header: t("denominations.columns.value"),
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="tabular-nums text-foreground">
            {format.currencyMinor(row.original.value_minor, { currency: row.original.currency })}
          </span>
        ),
      },
      {
        accessorKey: "code",
        header: t("denominations.columns.code"),
        cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{getValue() as string}</span>,
      },
      {
        accessorKey: "type",
        header: t("denominations.columns.type"),
        cell: ({ getValue }) => {
          const v = getValue() as DenominationType;
          return <Badge tone="info">{t(`denominations.type.${v}`)}</Badge>;
        },
      },
      {
        accessorKey: "status",
        header: t("denominations.columns.status"),
        cell: ({ getValue }) => {
          const v = getValue() as DenominationStatus;
          return <Badge tone={v === "active" ? "success" : "neutral"}>{t(`denominations.status.${v}`)}</Badge>;
        },
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: t("denominations.columns.actions"),
              meta: { align: "right" },
              cell: ({ row }) => {
                const d = row.original;
                const items: DropdownMenuItem[] = [
                  { label: t("denominations.actions.edit"), onClick: () => setDrawer({ mode: "edit", initial: d }) },
                  { kind: "separator" },
                  d.status === "active"
                    ? { label: t("denominations.actions.deactivate"), onClick: () => handleSetStatus(d, "inactive") }
                    : { label: t("denominations.actions.activate"), onClick: () => handleSetStatus(d, "active") },
                ];
                return (
                  <div className="flex justify-end">
                    <DropdownMenu trigger={<MoreVerticalIcon className="h-4 w-4" />} triggerLabel={t("denominations.actions.menu")} items={items} align="right" />
                  </div>
                );
              },
            } satisfies ColumnDef<Denomination, unknown>,
          ]
        : []),
    ],
    [t, format, canManage],
  );

  if (session.status !== "authenticated" || !canView) return null;

  const pageMeta = data?.meta.pagination;
  const pagination: DataTablePagination | undefined = pageMeta
    ? {
        page: pageMeta.current_page,
        pageSize: pageMeta.per_page,
        total: pageMeta.total,
        lastPage: pageMeta.last_page,
        onPageChange: setPage,
        onPageSizeChange: (size) => {
          setPageSize(size);
          setPage(1);
        },
      }
    : undefined;

  return (
    <>
      <PageHeader
        title={t("denominations.pageTitle")}
        description={t("denominations.pageDescription")}
        actions={
          canManage ? (
            <Button variant="primary" size="md" onClick={() => setDrawer({ mode: "create", initial: null })}>
              {t("denominations.actions.create")}
            </Button>
          ) : null
        }
      />

      {error ? (
        <Alert variant="danger" title={t("denominations.errorTitle")} action={<button type="button" onClick={refetch} className="text-xs font-semibold text-accent hover:underline">{t("common.tryAgain")}</button>}>
          {localizeApiMessage(error.message)}
        </Alert>
      ) : null}

      <DataTable<Denomination>
        columns={columns}
        data={rows}
        loading={loading && !data}
        emptyMessage={t("denominations.empty")}
        getRowId={(row) => row.public_id}
        pagination={pagination}
        title={t("denominations.listTitle")}
        titleAside={t("denominations.count", { count: pageMeta?.total ?? rows.length })}
      />

      {canManage ? (
        <DenominationDrawer
          open={drawer !== null}
          mode={drawer?.mode ?? "create"}
          initial={drawer?.initial ?? null}
          onClose={() => setDrawer(null)}
          onSubmit={handleSubmit}
        />
      ) : null}
    </>
  );
}

function DenominationDrawer({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial: Denomination | null;
  onClose: () => void;
  onSubmit: (payload: DenominationWritePayload) => Promise<void>;
}) {
  const t = useTranslations();
  const isEdit = mode === "edit";
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("XAF");
  const [type, setType] = useState<DenominationType>("banknote");
  const [status, setStatus] = useState<DenominationStatus>("active");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setGeneralError(null);
    setCode(initial?.code ?? "");
    setLabel(initial?.label ?? "");
    setValue(initial ? String(initial.value_minor / 100) : "");
    setCurrency(initial?.currency ?? "XAF");
    setType(initial?.type ?? "banknote");
    setStatus(initial?.status ?? "active");
  }, [open, initial]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);
    const major = Number(value.trim());
    const payload: DenominationWritePayload = {
      label: label.trim(),
      value_minor: Number.isFinite(major) ? Math.round(major * 100) : undefined,
      type,
      status,
      ...(isEdit ? {} : { code: code.trim(), currency: currency.trim().toUpperCase() || "XAF" }),
    };
    try {
      await onSubmit(payload);
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        code: t("denominations.fields.code"),
        label: t("denominations.fields.label"),
        value_minor: t("denominations.fields.value"),
        currency: t("denominations.fields.currency"),
        type: t("denominations.fields.type"),
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
      title={isEdit ? t("denominations.drawer.titleEdit", { label: initial?.label ?? "" }) : t("denominations.drawer.titleCreate")}
      description={t("denominations.drawer.hint")}
      widthClassName="sm:w-[28rem]"
      footer={
        <>
          <Button variant="ghost" size="md" type="button" onClick={onClose} disabled={submitting}>{t("common.cancel")}</Button>
          <Button variant="primary" size="md" type="submit" form="denomination-form" disabled={submitting}>
            {submitting ? t("common.loading") : isEdit ? t("common.save") : t("denominations.drawer.create")}
          </Button>
        </>
      }
    >
      {generalError ? (
        <p className="mb-4 rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">{generalError}</p>
      ) : null}
      <form id="denomination-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label={t("denominations.fields.code")} value={code} onChange={(e) => setCode(e.target.value)} error={errors.code} disabled={isEdit} required={!isEdit} hint={isEdit ? t("denominations.fields.codeEditHint") : undefined} />
          <TextField label={t("denominations.fields.currency")} value={currency} onChange={(e) => setCurrency(e.target.value)} error={errors.currency} disabled={isEdit} hint={isEdit ? t("denominations.fields.currencyEditHint") : undefined} />
          <MoneyField label={t("denominations.fields.value")} value={value} onChange={(e) => setValue(e.target.value)} error={errors.value_minor} required hint={t("denominations.fields.valueHint")} />
          <Select label={t("denominations.fields.type")} value={type} options={[{ value: "banknote", label: t("denominations.type.banknote") }, { value: "coin", label: t("denominations.type.coin") }]} onChange={(n) => setType(n as DenominationType)} error={errors.type} />
          <TextField label={t("denominations.fields.label")} value={label} onChange={(e) => setLabel(e.target.value)} error={errors.label} required className="sm:col-span-2" />
          <Select label={t("denominations.fields.status")} value={status} options={[{ value: "active", label: t("denominations.status.active") }, { value: "inactive", label: t("denominations.status.inactive") }]} onChange={(n) => setStatus(n as DenominationStatus)} />
        </div>
      </form>
    </Drawer>
  );
}
