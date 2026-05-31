"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { MoneyField } from "@/components/ui/MoneyField";
import { localizeApiError } from "@/lib/api/errors";
import { useTranslations } from "@/lib/i18n/I18nProvider";
import { StaffUserPicker } from "../../_components/StaffUserPicker";
import { ImageUploadField } from "../../_components/ImageUploadField";
import type { Agency } from "@/lib/api/agencies";
import type {
  Client,
  ClientCollectionFrequency,
  ClientWritePayload,
} from "@/lib/api/clients";

export type ClientDrawerMode = "create" | "edit";

type Props = {
  open: boolean;
  mode: ClientDrawerMode;
  initial?: Client | null;
  agencies: ReadonlyArray<Agency>;
  onClose: () => void;
  onSubmit: (payload: ClientWritePayload) => Promise<void>;
};

type FormState = {
  first_name: string;
  last_name: string;
  middle_name: string;
  father_name: string;
  mother_name: string;
  date_of_birth: string;
  place_of_birth: string;
  gender: string;
  phone_number: string;
  home_phone_number: string;
  email: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  region: string;
  occupation: string;
  employer_name: string;
  profile_photo_document_public_id: string;
  agency_public_id: string;
  prospector_public_id: string;
  collection_agent_public_id: string;
  collection_type: string;
  collection_frequency: ClientCollectionFrequency | "";
  collection_target_amount: string;
};

const EMPTY: FormState = {
  first_name: "",
  last_name: "",
  middle_name: "",
  father_name: "",
  mother_name: "",
  date_of_birth: "",
  place_of_birth: "",
  gender: "",
  phone_number: "",
  home_phone_number: "",
  email: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  region: "",
  occupation: "",
  employer_name: "",
  profile_photo_document_public_id: "",
  agency_public_id: "",
  prospector_public_id: "",
  collection_agent_public_id: "",
  collection_type: "",
  collection_frequency: "",
  collection_target_amount: "",
};

export function ClientDrawer({
  open,
  mode,
  initial,
  agencies,
  onClose,
  onSubmit,
}: Props) {
  const t = useTranslations();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setGeneralError(null);
    if (mode === "edit" && initial) {
      setForm({
        first_name: initial.first_name ?? "",
        last_name: initial.last_name ?? "",
        middle_name: initial.middle_name ?? "",
        father_name: initial.father_name ?? "",
        mother_name: initial.mother_name ?? "",
        date_of_birth: initial.date_of_birth
          ? initial.date_of_birth.slice(0, 10)
          : "",
        place_of_birth: initial.place_of_birth ?? "",
        gender: initial.gender ?? "",
        phone_number: initial.phone_number ?? "",
        home_phone_number: initial.home_phone_number ?? "",
        email: initial.email ?? "",
        address_line_1: initial.address_line_1 ?? "",
        address_line_2: initial.address_line_2 ?? "",
        city: initial.city ?? "",
        region: initial.region ?? "",
        occupation: initial.occupation ?? "",
        employer_name: initial.employer_name ?? "",
        profile_photo_document_public_id:
          initial.profile_photo_document_public_id ?? "",
        agency_public_id: initial.agency_public_id ?? "",
        prospector_public_id: initial.prospector_public_id ?? "",
        collection_agent_public_id: initial.collection_agent_public_id ?? "",
        collection_type: initial.collection_type ?? "",
        collection_frequency: initial.collection_frequency ?? "",
        collection_target_amount:
          initial.collection_target_amount !== null
            ? String(initial.collection_target_amount)
            : "",
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

    const payload: ClientWritePayload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      middle_name: nullable(form.middle_name),
      father_name: nullable(form.father_name),
      mother_name: nullable(form.mother_name),
      date_of_birth: nullable(form.date_of_birth),
      place_of_birth: nullable(form.place_of_birth),
      gender: nullable(form.gender),
      phone_number: nullable(form.phone_number),
      home_phone_number: nullable(form.home_phone_number),
      email: nullable(form.email),
      address_line_1: nullable(form.address_line_1),
      address_line_2: nullable(form.address_line_2),
      city: nullable(form.city),
      region: nullable(form.region),
      occupation: nullable(form.occupation),
      employer_name: nullable(form.employer_name),
      profile_photo_document_public_id: nullable(
        form.profile_photo_document_public_id,
      ),
      // Agency is set at creation and immutable afterwards — the update
      // endpoint prohibits it. Omit on edit (stripUndefined drops it).
      agency_public_id:
        mode === "edit" ? undefined : nullable(form.agency_public_id),
      prospector_public_id: nullable(form.prospector_public_id),
      collection_agent_public_id: nullable(form.collection_agent_public_id),
      collection_type: nullable(form.collection_type),
      collection_frequency: form.collection_frequency
        ? (form.collection_frequency as ClientCollectionFrequency)
        : null,
      collection_target_amount: form.collection_target_amount.trim().length
        ? Number(form.collection_target_amount)
        : null,
    };

    try {
      await onSubmit(payload);
    } catch (cause) {
      const fieldLabels: Record<string, string> = {
        first_name: t("clients.fields.firstName"),
        last_name: t("clients.fields.lastName"),
        middle_name: t("clients.fields.middleName"),
        father_name: t("clients.fields.fatherName"),
        mother_name: t("clients.fields.motherName"),
        date_of_birth: t("clients.fields.dateOfBirth"),
        place_of_birth: t("clients.fields.placeOfBirth"),
        gender: t("clients.fields.gender"),
        phone_number: t("clients.fields.phone"),
        home_phone_number: t("clients.fields.homePhone"),
        email: t("clients.fields.email"),
        address_line_1: t("clients.fields.addressLine1"),
        address_line_2: t("clients.fields.addressLine2"),
        city: t("clients.fields.city"),
        region: t("clients.fields.region"),
        occupation: t("clients.fields.occupation"),
        employer_name: t("clients.fields.employerName"),
        profile_photo_document_public_id: t("clients.fields.photo"),
        agency_public_id: t("clients.fields.agency"),
        prospector_public_id: t("clients.fields.prospector"),
        collection_agent_public_id: t("clients.fields.collectionAgent"),
        collection_type: t("clients.fields.collectionType"),
        collection_frequency: t("clients.fields.collectionFrequency"),
        collection_target_amount: t("clients.fields.collectionTargetAmount"),
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

  const agencyOptions = agencies.map((agency) => ({
    value: agency.public_id,
    label: `${agency.code} — ${agency.name}`,
  }));

  const genderOptions = [
    { value: "male", label: t("clients.gender.male") },
    { value: "female", label: t("clients.gender.female") },
    { value: "other", label: t("clients.gender.other") },
  ];

  const frequencyOptions = [
    { value: "daily", label: t("clients.frequency.daily") },
    { value: "weekly", label: t("clients.frequency.weekly") },
    { value: "monthly", label: t("clients.frequency.monthly") },
    { value: "custom", label: t("clients.frequency.custom") },
  ];

  return (
    <Drawer
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={
        mode === "create"
          ? t("clients.drawer.titleCreate")
          : t("clients.drawer.titleEdit", {
              name:
                initial && (initial.first_name || initial.last_name)
                  ? `${initial.last_name ?? ""} ${initial.first_name ?? ""}`.trim()
                  : initial?.client_reference ?? "",
            })
      }
      description={
        mode === "create"
          ? t("clients.drawer.createHint")
          : t("clients.drawer.editHint", {
              reference: initial?.client_reference ?? "—",
            })
      }
      widthClassName="sm:w-[40rem]"
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
            form="client-form"
            disabled={submitting}
          >
            {submitting
              ? t("common.loading")
              : mode === "create"
                ? t("clients.drawer.create")
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
        id="client-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
        noValidate
      >
        <Section title={t("clients.drawer.sectionIdentity")}>
          <ImageUploadField
            label={t("clients.fields.photo")}
            value={form.profile_photo_document_public_id}
            category="client_profile_photo"
            onChange={(next) => set("profile_photo_document_public_id", next)}
            error={errors.profile_photo_document_public_id}
            hint={t("clients.fields.photoHint")}
          />
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label={t("clients.fields.lastName")}
              value={form.last_name}
              onChange={(event) => set("last_name", event.target.value)}
              error={errors.last_name}
              required
            />
            <TextField
              label={t("clients.fields.firstName")}
              value={form.first_name}
              onChange={(event) => set("first_name", event.target.value)}
              error={errors.first_name}
              required
            />
            <TextField
              label={t("clients.fields.middleName")}
              value={form.middle_name}
              onChange={(event) => set("middle_name", event.target.value)}
              error={errors.middle_name}
            />
            <Select
              label={t("clients.fields.gender")}
              value={form.gender}
              options={genderOptions}
              placeholder={t("clients.fields.genderPlaceholder")}
              isClearable
              onChange={(next) => set("gender", next)}
              error={errors.gender}
            />
            <TextField
              label={t("clients.fields.dateOfBirth")}
              type="date"
              value={form.date_of_birth}
              onChange={(event) => set("date_of_birth", event.target.value)}
              error={errors.date_of_birth}
            />
            <TextField
              label={t("clients.fields.placeOfBirth")}
              value={form.place_of_birth}
              onChange={(event) => set("place_of_birth", event.target.value)}
              error={errors.place_of_birth}
            />
            <TextField
              label={t("clients.fields.fatherName")}
              value={form.father_name}
              onChange={(event) => set("father_name", event.target.value)}
              error={errors.father_name}
            />
            <TextField
              label={t("clients.fields.motherName")}
              value={form.mother_name}
              onChange={(event) => set("mother_name", event.target.value)}
              error={errors.mother_name}
            />
          </div>
        </Section>

        <Section title={t("clients.drawer.sectionContact")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label={t("clients.fields.phone")}
              type="tel"
              value={form.phone_number}
              onChange={(event) => set("phone_number", event.target.value)}
              error={errors.phone_number}
              placeholder="+237 6.. .. .. .."
            />
            <TextField
              label={t("clients.fields.homePhone")}
              type="tel"
              value={form.home_phone_number}
              onChange={(event) =>
                set("home_phone_number", event.target.value)
              }
              error={errors.home_phone_number}
            />
            <TextField
              label={t("clients.fields.email")}
              type="email"
              value={form.email}
              onChange={(event) => set("email", event.target.value)}
              error={errors.email}
              className="sm:col-span-2"
            />
            <TextField
              label={t("clients.fields.addressLine1")}
              value={form.address_line_1}
              onChange={(event) => set("address_line_1", event.target.value)}
              error={errors.address_line_1}
              className="sm:col-span-2"
            />
            <TextField
              label={t("clients.fields.addressLine2")}
              value={form.address_line_2}
              onChange={(event) => set("address_line_2", event.target.value)}
              error={errors.address_line_2}
              className="sm:col-span-2"
            />
            <TextField
              label={t("clients.fields.city")}
              value={form.city}
              onChange={(event) => set("city", event.target.value)}
              error={errors.city}
            />
            <TextField
              label={t("clients.fields.region")}
              value={form.region}
              onChange={(event) => set("region", event.target.value)}
              error={errors.region}
            />
          </div>
        </Section>

        <Section title={t("clients.drawer.sectionProfessional")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label={t("clients.fields.occupation")}
              value={form.occupation}
              onChange={(event) => set("occupation", event.target.value)}
              error={errors.occupation}
            />
            <TextField
              label={t("clients.fields.employerName")}
              value={form.employer_name}
              onChange={(event) => set("employer_name", event.target.value)}
              error={errors.employer_name}
            />
          </div>
        </Section>

        <Section title={t("clients.drawer.sectionAssignment")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label={t("clients.fields.agency")}
              value={form.agency_public_id}
              options={agencyOptions}
              placeholder={t("clients.fields.agencyPlaceholder")}
              isClearable
              onChange={(next) => set("agency_public_id", next)}
              error={errors.agency_public_id}
              disabled={mode === "edit"}
              hint={mode === "edit" ? t("clients.fields.agencyEditHint") : undefined}
              className="sm:col-span-2"
            />
            <StaffUserPicker
              label={t("clients.fields.prospector")}
              value={form.prospector_public_id}
              placeholder={t("clients.fields.prospectorPlaceholder")}
              onChange={(next) => set("prospector_public_id", next)}
              error={errors.prospector_public_id}
            />
            <StaffUserPicker
              label={t("clients.fields.collectionAgent")}
              value={form.collection_agent_public_id}
              placeholder={t("clients.fields.collectionAgentPlaceholder")}
              onChange={(next) => set("collection_agent_public_id", next)}
              error={errors.collection_agent_public_id}
            />
          </div>
        </Section>

        <Section title={t("clients.drawer.sectionCollection")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label={t("clients.fields.collectionType")}
              value={form.collection_type}
              onChange={(event) => set("collection_type", event.target.value)}
              error={errors.collection_type}
            />
            <Select
              label={t("clients.fields.collectionFrequency")}
              value={form.collection_frequency}
              options={frequencyOptions}
              placeholder={t("clients.fields.collectionFrequencyPlaceholder")}
              isClearable
              onChange={(next) =>
                set("collection_frequency", next as ClientCollectionFrequency)
              }
              error={errors.collection_frequency}
            />
            <MoneyField
              label={t("clients.fields.collectionTargetAmount")}
              value={form.collection_target_amount}
              onChange={(event) =>
                set("collection_target_amount", event.target.value)
              }
              error={errors.collection_target_amount}
              className="sm:col-span-2"
              hint={t("clients.fields.collectionTargetAmountHint")}
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
