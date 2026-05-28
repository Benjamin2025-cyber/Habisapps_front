"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { localizeApiError } from "@/lib/api/errors";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type {
  Agency,
  AgencyStatus,
  AgencyWritePayload,
} from "@/lib/api/agencies";

export type AgencyDrawerMode = "create" | "edit";

type Props = {
  open: boolean;
  mode: AgencyDrawerMode;
  /** Existing agency when editing. */
  initial?: Agency | null;
  onClose: () => void;
  onSubmit: (payload: AgencyWritePayload) => Promise<void>;
};

type FormState = {
  code: string;
  name: string;
  region: string;
  city: string;
  branch_name: string;
  branch_type: string;
  phone_number: string;
  fax_number: string;
  email: string;
  address_line_1: string;
  address_line_2: string;
  po_box: string;
  geographic_description: string;
  creation_date: string;
  status: AgencyStatus | "";
};

const EMPTY: FormState = {
  code: "",
  name: "",
  region: "",
  city: "",
  branch_name: "",
  branch_type: "",
  phone_number: "",
  fax_number: "",
  email: "",
  address_line_1: "",
  address_line_2: "",
  po_box: "",
  geographic_description: "",
  creation_date: "",
  status: "active",
};

export function AgencyDrawer({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: Props) {
  const t = useTranslations();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Reset state every time the drawer opens with a new context.
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setGeneralError(null);
    if (mode === "edit" && initial) {
      setForm({
        code: initial.code,
        name: initial.name,
        region: initial.region ?? "",
        city: initial.city ?? "",
        branch_name: initial.branch_name ?? "",
        branch_type: initial.branch_type ?? "",
        phone_number: initial.phone_number ?? "",
        fax_number: initial.fax_number ?? "",
        email: initial.email ?? "",
        address_line_1: initial.address_line_1 ?? "",
        address_line_2: initial.address_line_2 ?? "",
        po_box: initial.po_box ?? "",
        geographic_description: initial.geographic_description ?? "",
        creation_date: initial.creation_date
          ? initial.creation_date.slice(0, 10)
          : "",
        status: initial.status,
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, mode, initial]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);

    const payload: AgencyWritePayload = {
      name: form.name.trim(),
      region: nullable(form.region),
      city: nullable(form.city),
      branch_name: nullable(form.branch_name),
      branch_type: nullable(form.branch_type),
      phone_number: nullable(form.phone_number),
      fax_number: nullable(form.fax_number),
      email: nullable(form.email),
      address_line_1: nullable(form.address_line_1),
      address_line_2: nullable(form.address_line_2),
      po_box: nullable(form.po_box),
      geographic_description: nullable(form.geographic_description),
      creation_date: nullable(form.creation_date),
    };

    if (mode === "create") {
      payload.code = form.code.trim();
      if (form.status) payload.status = form.status;
    }

    try {
      await onSubmit(payload);
    } catch (cause) {
      const fieldLabels: Record<string, string> = {
        code: t("agencies.fields.code"),
        name: t("agencies.fields.name"),
        region: t("agencies.fields.region"),
        city: t("agencies.fields.city"),
        branch_name: t("agencies.fields.branchName"),
        branch_type: t("agencies.fields.branchType"),
        phone_number: t("agencies.fields.phone"),
        fax_number: t("agencies.fields.fax"),
        email: t("agencies.fields.email"),
        address_line_1: t("agencies.fields.addressLine1"),
        address_line_2: t("agencies.fields.addressLine2"),
        po_box: t("agencies.fields.poBox"),
        creation_date: t("agencies.fields.creationDate"),
        status: t("agencies.fields.status"),
        geographic_description: t("agencies.fields.geographic"),
      };
      const { generalMessage, fieldErrors } = localizeApiError(
        cause,
        fieldLabels,
      );
      setErrors(fieldErrors);
      setGeneralError(generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  const statusOptions = (["active", "inactive", "suspended"] as const).map(
    (status) => ({
      value: status,
      label: t(`agencies.status.${status}`),
    }),
  );

  return (
    <Drawer
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={
        mode === "create"
          ? t("agencies.drawer.titleCreate")
          : t("agencies.drawer.titleEdit", { name: initial?.name ?? "" })
      }
      description={
        mode === "edit"
          ? t("agencies.drawer.editHint", { code: initial?.code ?? "" })
          : t("agencies.drawer.createHint")
      }
      footer={
        <>
          <Button
            variant="ghost"
            size="md"
            type="button"
            onClick={onClose}
            disabled={submitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            form="agency-form"
            disabled={submitting}
          >
            {submitting
              ? t("common.loading")
              : mode === "create"
                ? t("agencies.drawer.create")
                : t("common.save")}
          </Button>
        </>
      }
    >
      {generalError ? (
        <p className="mb-4 rounded-[var(--radius-field)] border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
          {generalError}
        </p>
      ) : null}

      <form
        id="agency-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label={t("agencies.fields.code")}
            value={form.code}
            onChange={(event) => set("code", event.target.value)}
            error={errors.code}
            disabled={mode === "edit"}
            required={mode === "create"}
            placeholder="AG001"
          />
          <TextField
            label={t("agencies.fields.name")}
            value={form.name}
            onChange={(event) => set("name", event.target.value)}
            error={errors.name}
            required
          />
          <TextField
            label={t("agencies.fields.region")}
            value={form.region}
            onChange={(event) => set("region", event.target.value)}
            error={errors.region}
          />
          <TextField
            label={t("agencies.fields.city")}
            value={form.city}
            onChange={(event) => set("city", event.target.value)}
            error={errors.city}
          />
          <TextField
            label={t("agencies.fields.branchName")}
            value={form.branch_name}
            onChange={(event) => set("branch_name", event.target.value)}
            error={errors.branch_name}
          />
          <TextField
            label={t("agencies.fields.branchType")}
            value={form.branch_type}
            onChange={(event) => set("branch_type", event.target.value)}
            error={errors.branch_type}
          />
          <TextField
            label={t("agencies.fields.phone")}
            value={form.phone_number}
            onChange={(event) => set("phone_number", event.target.value)}
            error={errors.phone_number}
            placeholder="+237 6.. .. .. .."
          />
          <TextField
            label={t("agencies.fields.fax")}
            value={form.fax_number}
            onChange={(event) => set("fax_number", event.target.value)}
            error={errors.fax_number}
          />
          <TextField
            label={t("agencies.fields.email")}
            type="email"
            value={form.email}
            onChange={(event) => set("email", event.target.value)}
            error={errors.email}
          />
          <TextField
            label={t("agencies.fields.poBox")}
            value={form.po_box}
            onChange={(event) => set("po_box", event.target.value)}
            error={errors.po_box}
          />
          <TextField
            label={t("agencies.fields.addressLine1")}
            value={form.address_line_1}
            onChange={(event) => set("address_line_1", event.target.value)}
            error={errors.address_line_1}
            className="sm:col-span-2"
          />
          <TextField
            label={t("agencies.fields.addressLine2")}
            value={form.address_line_2}
            onChange={(event) => set("address_line_2", event.target.value)}
            error={errors.address_line_2}
            className="sm:col-span-2"
          />
          <TextField
            label={t("agencies.fields.creationDate")}
            type="date"
            value={form.creation_date}
            onChange={(event) => set("creation_date", event.target.value)}
            error={errors.creation_date}
          />
          {mode === "create" ? (
            <Select
              label={t("agencies.fields.status")}
              value={form.status}
              options={statusOptions}
              onChange={(event) =>
                set("status", event.target.value as AgencyStatus)
              }
              error={errors.status}
            />
          ) : null}
        </div>

        <div>
          <label
            htmlFor="agency-geographic-description"
            className="text-sm font-medium text-foreground"
          >
            {t("agencies.fields.geographic")}
          </label>
          <textarea
            id="agency-geographic-description"
            value={form.geographic_description}
            onChange={(event) =>
              set("geographic_description", event.target.value)
            }
            rows={3}
            className="mt-2 w-full rounded-[var(--radius-field)] border border-input bg-background px-4 py-3 text-sm text-foreground focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring/10"
            placeholder={t("agencies.fields.geographicPlaceholder")}
          />
          {errors.geographic_description ? (
            <p className="mt-1 text-xs text-danger">
              {errors.geographic_description}
            </p>
          ) : null}
        </div>
      </form>
    </Drawer>
  );
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
