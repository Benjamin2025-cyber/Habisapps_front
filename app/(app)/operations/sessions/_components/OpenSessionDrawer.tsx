"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { localizeApiError } from "@/lib/api/errors";
import type { StaffUser } from "@/lib/api/staff-users";
import type { OpenTellerSessionPayload } from "@/lib/api/teller-sessions";
import type { Till } from "@/lib/api/tills";
import { useTranslations } from "@/lib/i18n/I18nProvider";

type Props = {
  open: boolean;
  /** Eligible tills: active + daily_state closed. */
  tills: ReadonlyArray<Till>;
  tellers: ReadonlyArray<StaffUser>;
  onClose: () => void;
  onSubmit: (payload: OpenTellerSessionPayload) => Promise<void>;
};

export function OpenSessionDrawer({
  open,
  tills,
  tellers,
  onClose,
  onSubmit,
}: Props) {
  const t = useTranslations();

  const [tillId, setTillId] = useState("");
  const [tellerId, setTellerId] = useState("");
  const [businessDate, setBusinessDate] = useState("");
  const [opening, setOpening] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTillId("");
    setTellerId("");
    setBusinessDate("");
    setOpening("");
    setErrors({});
    setGeneralError(null);
  }, [open]);

  const tillOptions = useMemo(
    () =>
      tills.map((till) => ({
        value: till.public_id,
        label: `${till.code} — ${till.name}`,
      })),
    [tills],
  );

  const selectedTill = tills.find((till) => till.public_id === tillId) ?? null;
  const lockedToAssigned = !!selectedTill?.assigned_user_public_id;

  // Mirror the API rules (TellerSessionWorkflow): the teller must be an active
  // teller/cashier of the till's agency, AND — if the till has an assigned
  // cashier — it must be that exact cashier.
  const tellerOptions = useMemo(() => {
    if (!selectedTill) return [];
    if (selectedTill.assigned_user_public_id) {
      const u = tellers.find(
        (x) => x.public_id === selectedTill.assigned_user_public_id,
      );
      return [
        {
          value: selectedTill.assigned_user_public_id,
          label: u?.name ?? selectedTill.assigned_user_public_id,
        },
      ];
    }
    return tellers
      .filter(
        (u) =>
          u.status === "active" &&
          (u.roles.includes("teller") || u.roles.includes("cashier")) &&
          u.agency_public_id === selectedTill.agency_public_id,
      )
      .map((u) => ({ value: u.public_id, label: u.name }));
  }, [tellers, selectedTill]);

  // Picking a till resets the teller; if the till has an assigned cashier,
  // pre-select (and lock) it.
  function onTillChange(next: string) {
    setTillId(next);
    const till = tills.find((t) => t.public_id === next) ?? null;
    setTellerId(till?.assigned_user_public_id ?? "");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);

    const minor = Math.round(Number(opening.trim() || "0") * 100);
    const payload: OpenTellerSessionPayload = {
      till_public_id: tillId,
      teller_user_public_id: tellerId || null,
      business_date: businessDate,
      opening_declaration_minor: Number.isFinite(minor) ? minor : 0,
      currency: selectedTill?.currency ?? undefined,
    };

    try {
      await onSubmit(payload);
    } catch (cause) {
      const { generalMessage, fieldErrors } = localizeApiError(cause, {
        till_public_id: t("sessions.fields.till"),
        teller_user_public_id: t("sessions.fields.teller"),
        business_date: t("sessions.fields.businessDate"),
        opening_declaration_minor: t("sessions.fields.opening"),
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
      title={t("sessions.openDrawer.title")}
      description={t("sessions.openDrawer.hint")}
      widthClassName="sm:w-[30rem]"
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
            form="open-session-form"
            disabled={submitting}
          >
            {submitting ? t("common.loading") : t("sessions.openDrawer.confirm")}
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
        id="open-session-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        <Select
          label={t("sessions.fields.till")}
          value={tillId}
          options={tillOptions}
          placeholder={t("sessions.fields.tillPlaceholder")}
          onChange={onTillChange}
          error={errors.till_public_id}
          required
          hint={
            tillOptions.length === 0
              ? t("sessions.fields.noEligibleTills")
              : t("sessions.fields.tillHint")
          }
        />
        <Select
          label={t("sessions.fields.teller")}
          value={tellerId}
          options={tellerOptions}
          placeholder={t("sessions.fields.tellerPlaceholder")}
          isClearable={!lockedToAssigned}
          disabled={!selectedTill || lockedToAssigned}
          onChange={setTellerId}
          error={errors.teller_user_public_id}
          hint={
            !selectedTill
              ? t("sessions.fields.tellerSelectTillFirst")
              : lockedToAssigned
                ? t("sessions.fields.tellerLocked")
                : tellerOptions.length === 0
                  ? t("sessions.fields.noTellersAgency")
                  : t("sessions.fields.tellerHint")
          }
        />
        <TextField
          label={t("sessions.fields.businessDate")}
          type="date"
          value={businessDate}
          onChange={(event) => setBusinessDate(event.target.value)}
          error={errors.business_date}
          required
        />
        <TextField
          label={t("sessions.fields.opening")}
          type="number"
          value={opening}
          onChange={(event) => setOpening(event.target.value)}
          error={errors.opening_declaration_minor}
          required
          hint={t("sessions.fields.openingHint")}
        />
      </form>
    </Drawer>
  );
}
