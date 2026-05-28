"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { localizeApiError } from "@/lib/api/errors";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import type { Agency } from "@/lib/api/agencies";
import type { Role } from "@/lib/api/roles";
import type {
  StaffUser,
  StaffUserWritePayload,
} from "@/lib/api/staff-users";

export type StaffUserDrawerMode = "create" | "edit";

type Props = {
  open: boolean;
  mode: StaffUserDrawerMode;
  initial?: StaffUser | null;
  agencies: ReadonlyArray<Agency>;
  /** Role catalog from `GET /roles`. Used only in create mode. */
  roles: ReadonlyArray<Role>;
  onClose: () => void;
  /**
   * In create mode the caller receives the selected role names alongside the
   * profile payload and is expected to chain `PUT /staff-users/{id}/roles`.
   * In edit mode `selectedRoles` is empty.
   */
  onSubmit: (payload: StaffUserWritePayload, selectedRoles: string[]) => Promise<void>;
};

type FormState = {
  name: string;
  phone_number: string;
  email: string;
  matricule: string;
  job_title: string;
  gender: string;
  birth_date: string;
  birth_place: string;
  service_name: string;
  portfolio_code: string;
  agency_code: string;
};

const EMPTY: FormState = {
  name: "",
  phone_number: "",
  email: "",
  matricule: "",
  job_title: "",
  gender: "",
  birth_date: "",
  birth_place: "",
  service_name: "",
  portfolio_code: "",
  agency_code: "",
};

export function StaffUserDrawer({
  open,
  mode,
  initial,
  agencies,
  roles,
  onClose,
  onSubmit,
}: Props) {
  const t = useTranslations();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setGeneralError(null);
    setSelectedRoles(new Set());
    if (mode === "edit" && initial) {
      const profile = initial.professional_profile;
      setForm({
        name: initial.name,
        phone_number: initial.phone_number,
        email: initial.email ?? "",
        matricule: initial.matricule ?? "",
        job_title: initial.job_title ?? "",
        gender: profile?.gender ?? "",
        birth_date: profile?.birth_date ?? "",
        birth_place: profile?.birth_place ?? "",
        service_name: profile?.service_name ?? "",
        portfolio_code: profile?.portfolio_code ?? "",
        agency_code: initial.agency_code ?? "",
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

    const payload: StaffUserWritePayload = {
      name: form.name.trim(),
      phone_number: form.phone_number.trim(),
      email: nullable(form.email),
      matricule: nullable(form.matricule),
      job_title: nullable(form.job_title),
      gender: nullable(form.gender),
      birth_date: nullable(form.birth_date),
      birth_place: nullable(form.birth_place),
      service_name: nullable(form.service_name),
      portfolio_code: nullable(form.portfolio_code),
      agency_code: nullable(form.agency_code),
    };

    try {
      await onSubmit(payload, Array.from(selectedRoles));
    } catch (cause) {
      const fieldLabels: Record<string, string> = {
        name: t("staffUsers.fields.name"),
        phone_number: t("staffUsers.fields.phone"),
        email: t("staffUsers.fields.email"),
        matricule: t("staffUsers.fields.matricule"),
        job_title: t("staffUsers.fields.jobTitle"),
        gender: t("staffUsers.fields.gender"),
        birth_date: t("staffUsers.fields.birthDate"),
        birth_place: t("staffUsers.fields.birthPlace"),
        service_name: t("staffUsers.fields.serviceName"),
        portfolio_code: t("staffUsers.fields.portfolioCode"),
        agency_code: t("staffUsers.fields.agency"),
      };
      const { generalMessage, fieldErrors } = localizeApiError(cause, fieldLabels);
      setErrors(fieldErrors);
      setGeneralError(generalMessage);
    } finally {
      setSubmitting(false);
    }
  }

  const agencyOptions = agencies.map((agency) => ({
    value: agency.code,
    label: `${agency.code} — ${agency.name}`,
  }));

  const genderOptions = [
    { value: "male", label: t("staffUsers.gender.male") },
    { value: "female", label: t("staffUsers.gender.female") },
    { value: "other", label: t("staffUsers.gender.other") },
  ];

  const roleOptions = useMemo<MultiSelectOption[]>(
    () =>
      roles
        .filter((role) => role.assignable)
        .map((role) => ({
          value: role.name,
          label: role.display_name,
          description: role.description || undefined,
          hint: t("staffUsers.rolesDrawer.permissionsCount", {
            count: role.permissions.length,
          }),
        })),
    [roles, t],
  );

  return (
    <Drawer
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={
        mode === "create"
          ? t("staffUsers.drawer.titleCreate")
          : t("staffUsers.drawer.titleEdit", { name: initial?.name ?? "" })
      }
      description={
        mode === "create"
          ? t("staffUsers.drawer.createHint")
          : t("staffUsers.drawer.editHint")
      }
      widthClassName="sm:w-[36rem]"
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
            form="staff-user-form"
            disabled={submitting}
          >
            {submitting
              ? t("common.loading")
              : mode === "create"
                ? t("staffUsers.drawer.create")
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

      {mode === "create" ? (
        <p className="mb-4 rounded-[var(--radius-field)] border border-info/20 bg-info/10 px-3 py-2 text-xs text-info">
          {t("staffUsers.drawer.activationNotice")}
        </p>
      ) : null}

      <form
        id="staff-user-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
        noValidate
      >
        <Section title={t("staffUsers.drawer.sectionIdentity")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label={t("staffUsers.fields.name")}
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              error={errors.name}
              required
              className="sm:col-span-2"
            />
            <TextField
              label={t("staffUsers.fields.phone")}
              type="tel"
              value={form.phone_number}
              onChange={(event) => set("phone_number", event.target.value)}
              error={errors.phone_number}
              required
              placeholder="+237 6.. .. .. .."
              disabled={mode === "edit"}
              hint={
                mode === "edit"
                  ? t("staffUsers.fields.phoneEditHint")
                  : undefined
              }
            />
            <TextField
              label={t("staffUsers.fields.email")}
              type="email"
              value={form.email}
              onChange={(event) => set("email", event.target.value)}
              error={errors.email}
            />
            <TextField
              label={t("staffUsers.fields.matricule")}
              value={form.matricule}
              onChange={(event) => set("matricule", event.target.value)}
              error={errors.matricule}
              hint={t("staffUsers.fields.matriculeHint")}
            />
            <TextField
              label={t("staffUsers.fields.jobTitle")}
              value={form.job_title}
              onChange={(event) => set("job_title", event.target.value)}
              error={errors.job_title}
            />
          </div>
        </Section>

        <Section title={t("staffUsers.drawer.sectionAssignment")}>
          <Select
            label={t("staffUsers.fields.agency")}
            value={form.agency_code}
            options={agencyOptions}
            placeholder={t("staffUsers.fields.agencyPlaceholder")}
            isClearable
            onChange={(next) => set("agency_code", next)}
            error={errors.agency_code}
          />
        </Section>

        {mode === "create" ? (
          <Section title={t("staffUsers.drawer.sectionRoles")}>
            <MultiSelect
              label={t("staffUsers.fields.roles")}
              options={roleOptions}
              selected={Array.from(selectedRoles)}
              onChange={(next) => setSelectedRoles(new Set(next))}
              placeholder={t("staffUsers.drawer.rolesPlaceholder")}
              hint={t("staffUsers.drawer.rolesHint")}
              emptyOptionsLabel={t("staffUsers.rolesDrawer.empty")}
              size="md"
            />
          </Section>
        ) : null}

        <Section title={t("staffUsers.drawer.sectionProfile")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label={t("staffUsers.fields.gender")}
              value={form.gender}
              options={genderOptions}
              placeholder={t("staffUsers.fields.genderPlaceholder")}
              isClearable
              onChange={(next) => set("gender", next)}
              error={errors.gender}
            />
            <TextField
              label={t("staffUsers.fields.birthDate")}
              type="date"
              value={form.birth_date}
              onChange={(event) => set("birth_date", event.target.value)}
              error={errors.birth_date}
            />
            <TextField
              label={t("staffUsers.fields.birthPlace")}
              value={form.birth_place}
              onChange={(event) => set("birth_place", event.target.value)}
              error={errors.birth_place}
            />
            <TextField
              label={t("staffUsers.fields.serviceName")}
              value={form.service_name}
              onChange={(event) => set("service_name", event.target.value)}
              error={errors.service_name}
            />
            <TextField
              label={t("staffUsers.fields.portfolioCode")}
              value={form.portfolio_code}
              onChange={(event) => set("portfolio_code", event.target.value)}
              error={errors.portfolio_code}
              className="sm:col-span-2"
            />
          </div>
        </Section>
      </form>
    </Drawer>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
