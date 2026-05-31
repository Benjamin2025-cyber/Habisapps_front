"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { localizeApiError } from "@/lib/api/errors";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type {
  Sector,
  SectorStatus,
  SubSector,
  SubSectorCreatePayload,
  SubSectorUpdatePayload,
} from "@/lib/api/sectors";

export type SubSectorDrawerMode = "create" | "edit";

type Props = {
  open: boolean;
  mode: SubSectorDrawerMode;
  initial?: SubSector | null;
  sectors: ReadonlyArray<Sector>;
  /** Pre-selected parent sector when creating from the detail panel. */
  defaultSectorPublicId?: string | null;
  onClose: () => void;
  onSubmit: (
    payload: SubSectorCreatePayload | SubSectorUpdatePayload,
  ) => Promise<void>;
};

const STATUSES: SectorStatus[] = ["active", "inactive", "archived"];

export function SubSectorDrawer({
  open,
  mode,
  initial,
  sectors,
  defaultSectorPublicId,
  onClose,
  onSubmit,
}: Props) {
  const t = useTranslations();
  const isEdit = mode === "edit";

  const [sectorPublicId, setSectorPublicId] = useState("");
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
    setSectorPublicId(
      isEdit
        ? (initial?.sector_public_id ?? "")
        : (defaultSectorPublicId ?? ""),
    );
    setCode(isEdit ? (initial?.code ?? "") : "");
    setName(isEdit ? (initial?.name ?? "") : "");
    setStatus(isEdit ? ((initial?.status as SectorStatus) ?? "") : "");
  }, [open, isEdit, initial, defaultSectorPublicId]);

  const sectorOptions = useMemo(
    () =>
      sectors.map((s) => ({
        value: s.public_id,
        label: `${s.code} — ${s.name}`,
      })),
    [sectors],
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);

    const payload: SubSectorCreatePayload | SubSectorUpdatePayload = isEdit
      ? {
          sector_public_id: sectorPublicId || undefined,
          name: name.trim(),
          status: status || undefined,
        }
      : {
          sector_public_id: sectorPublicId,
          code: code.trim(),
          name: name.trim(),
          status: status || undefined,
        };

    try {
      await onSubmit(payload);
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        sector_public_id: t("sectors.fields.sector"),
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
          ? t("sectors.subSectorDrawer.titleEdit", {
              name: initial?.name ?? "",
            })
          : t("sectors.subSectorDrawer.titleCreate")
      }
      description={t("sectors.subSectorDrawer.hint")}
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
            form="sub-sector-form"
            disabled={submitting}
          >
            {submitting
              ? t("common.loading")
              : isEdit
                ? t("common.save")
                : t("sectors.subSectorDrawer.create")}
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
        id="sub-sector-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        <Select
          label={t("sectors.fields.sector")}
          value={sectorPublicId}
          options={sectorOptions}
          placeholder={t("sectors.fields.sectorPlaceholder")}
          onChange={setSectorPublicId}
          error={errors.sector_public_id}
          required
        />
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
