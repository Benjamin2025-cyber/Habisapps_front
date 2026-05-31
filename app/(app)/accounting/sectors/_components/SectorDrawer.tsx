"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { localizeApiError } from "@/lib/api/errors";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type {
  Sector,
  SectorCreatePayload,
  SectorStatus,
  SectorUpdatePayload,
} from "@/lib/api/sectors";

export type SectorDrawerMode = "create" | "edit";

type Props = {
  open: boolean;
  mode: SectorDrawerMode;
  initial?: Sector | null;
  onClose: () => void;
  onSubmit: (payload: SectorCreatePayload | SectorUpdatePayload) => Promise<void>;
};

const STATUSES: SectorStatus[] = ["active", "inactive", "archived"];

export function SectorDrawer({ open, mode, initial, onClose, onSubmit }: Props) {
  const t = useTranslations();
  const isEdit = mode === "edit";

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<SectorStatus | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setGeneralError(null);
    setCode(isEdit ? (initial?.code ?? "") : "");
    setName(isEdit ? (initial?.name ?? "") : "");
    setStatus(isEdit ? ((initial?.status as SectorStatus) ?? "") : "");
  }, [open, isEdit, initial]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);

    const payload: SectorCreatePayload | SectorUpdatePayload = isEdit
      ? { name: name.trim(), status: status || undefined }
      : { code: code.trim(), name: name.trim(), status: status || undefined };

    try {
      await onSubmit(payload);
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        code: t("sectors.fields.code"),
        name: t("sectors.fields.name"),
        status: t("sectors.fields.status"),
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
        isEdit
          ? t("sectors.sectorDrawer.titleEdit", { name: initial?.name ?? "" })
          : t("sectors.sectorDrawer.titleCreate")
      }
      description={t("sectors.sectorDrawer.hint")}
      widthClassName="sm:w-[28rem]"
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
            form="sector-form"
            disabled={submitting}
          >
            {submitting
              ? t("common.loading")
              : isEdit
                ? t("common.save")
                : t("sectors.sectorDrawer.create")}
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
        id="sector-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        <TextField
          label={t("sectors.fields.code")}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          error={errors.code}
          disabled={isEdit}
          required={!isEdit}
          hint={isEdit ? t("sectors.fields.codeEditHint") : undefined}
        />
        <TextField
          label={t("sectors.fields.name")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          required
        />
        <Select
          label={t("sectors.fields.status")}
          value={status}
          options={STATUSES.map((s) => ({
            value: s,
            label: t(`sectors.status.${s}`),
          }))}
          placeholder={t("sectors.fields.statusPlaceholder")}
          isClearable
          onChange={(next) => setStatus(next as SectorStatus | "")}
          error={errors.status}
        />
      </form>
    </Drawer>
  );
}
