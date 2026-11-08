"use client";

import { useTranslations } from "next-intl";
import { ActionForm, Field, SelectField } from "@/components/form";
import {
  addAddressAction,
  addContactAction,
  addRepresentativeAction,
  createCostCenterAction,
  createDepartmentAction,
  updateProfileAction,
  updateSettingsAction,
} from "@/modules/org/actions";
import type { OrgSettings } from "@/modules/org/schemas";

type Profile = {
  name: string;
  legalName: string;
  country: string;
  currency: string;
  taxRegime: string | null;
  vatNumber: string | null;
  commercialRegistry: string | null;
  email: string;
  phone: string | null;
  website: string | null;
};

export function ProfileForm({ profile }: { profile: Profile }) {
  const t = useTranslations();
  return (
    <ActionForm action={updateProfileAction} submitLabel={t("common.save")}>
      {(s) => (
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="name" label={t("org.name")} state={s} defaultValue={profile.name} required />
          <Field name="legalName" label={t("org.legalName")} state={s} defaultValue={profile.legalName} required />
          <Field name="country" label={t("common.country")} state={s} defaultValue={profile.country} required />
          <Field name="currency" label={t("common.currency")} state={s} defaultValue={profile.currency} required />
          <Field name="taxRegime" label={t("org.taxRegime")} state={s} defaultValue={profile.taxRegime} />
          <Field name="vatNumber" label={t("org.vatNumber")} state={s} defaultValue={profile.vatNumber} />
          <Field
            name="commercialRegistry"
            label={t("org.commercialRegistry")}
            state={s}
            defaultValue={profile.commercialRegistry}
          />
          <Field name="email" type="email" label={t("common.email")} state={s} defaultValue={profile.email} required />
          <Field name="phone" label={t("common.phone")} state={s} defaultValue={profile.phone} />
          <Field name="website" label={t("org.website")} state={s} defaultValue={profile.website} />
        </div>
      )}
    </ActionForm>
  );
}

const ADDRESS_TYPES = ["HEADQUARTERS", "BILLING", "OPERATIONS", "WAREHOUSE", "OTHER"];

export function AddressForm() {
  const t = useTranslations();
  return (
    <ActionForm action={addAddressAction} submitLabel={t("common.add")} resetOnSuccess variant="secondary">
      {(s) => (
        <div className="grid gap-3 md:grid-cols-3">
          <SelectField
            name="type"
            label={t("org.addressType")}
            state={s}
            options={ADDRESS_TYPES.map((v) => ({ value: v, label: t(`org.addrType.${v}`) }))}
          />
          <Field name="line1" label={t("org.line1")} state={s} required />
          <Field name="line2" label={t("org.line2")} state={s} />
          <Field name="city" label={t("org.city")} state={s} required />
          <Field name="province" label={t("org.province")} state={s} />
          <Field name="postalCode" label={t("org.postalCode")} state={s} />
          <Field name="country" label={t("common.country")} state={s} defaultValue="AO" required />
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="isPrimary" /> {t("common.primary")}
          </label>
        </div>
      )}
    </ActionForm>
  );
}

export function ContactForm() {
  const t = useTranslations();
  return (
    <ActionForm action={addContactAction} submitLabel={t("common.add")} resetOnSuccess variant="secondary">
      {(s) => (
        <div className="grid gap-3 md:grid-cols-4">
          <Field name="name" label={t("common.name")} state={s} required />
          <Field name="role" label={t("org.contactRole")} state={s} />
          <Field name="email" type="email" label={t("common.email")} state={s} />
          <Field name="phone" label={t("common.phone")} state={s} />
        </div>
      )}
    </ActionForm>
  );
}

export function RepresentativeForm() {
  const t = useTranslations();
  return (
    <ActionForm action={addRepresentativeAction} submitLabel={t("common.add")} resetOnSuccess variant="secondary">
      {(s) => (
        <div className="grid gap-3 md:grid-cols-3">
          <Field name="name" label={t("common.name")} state={s} required />
          <Field name="position" label={t("org.position")} state={s} />
          <Field name="documentType" label={t("org.documentType")} state={s} />
          <Field name="documentNumber" label={t("org.documentNumber")} state={s} />
          <Field name="email" type="email" label={t("common.email")} state={s} />
          <Field name="phone" label={t("common.phone")} state={s} />
        </div>
      )}
    </ActionForm>
  );
}

export function DepartmentForm() {
  const t = useTranslations();
  return (
    <ActionForm
      action={createDepartmentAction}
      submitLabel={t("common.add")}
      resetOnSuccess
      className="grid items-end gap-3 md:grid-cols-[1fr_200px_auto]"
    >
      {(s) => (
        <>
          <Field name="name" label={t("common.name")} state={s} required />
          <Field name="code" label={t("org.code")} state={s} />
        </>
      )}
    </ActionForm>
  );
}

export function CostCenterForm({ departments }: { departments: { id: string; name: string }[] }) {
  const t = useTranslations();
  return (
    <ActionForm
      action={createCostCenterAction}
      submitLabel={t("common.add")}
      resetOnSuccess
      className="grid items-end gap-3 md:grid-cols-[160px_1fr_1fr_auto]"
    >
      {(s) => (
        <>
          <Field name="code" label={t("org.code")} state={s} required />
          <Field name="name" label={t("common.name")} state={s} required />
          <SelectField
            name="departmentId"
            label={t("org.department")}
            state={s}
            options={[{ value: "", label: "—" }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
          />
        </>
      )}
    </ActionForm>
  );
}

export function SettingsForm({ settings }: { settings: OrgSettings }) {
  const t = useTranslations();
  return (
    <ActionForm action={updateSettingsAction} submitLabel={t("common.save")}>
      {(s) => (
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            name="defaultLocale"
            label={t("org.defaultLocale")}
            state={s}
            defaultValue={settings.defaultLocale}
            options={[
              { value: "pt-PT", label: "Português (PT)" },
              { value: "en", label: "English" },
            ]}
          />
          <Field name="timezone" label={t("org.timezone")} state={s} defaultValue={settings.timezone} required />
          <SelectField
            name="dateFormat"
            label={t("org.dateFormat")}
            state={s}
            defaultValue={settings.dateFormat}
            options={["dd/MM/yyyy", "yyyy-MM-dd", "MM/dd/yyyy"].map((v) => ({ value: v, label: v }))}
          />
          <SelectField
            name="fiscalYearStartMonth"
            label={t("org.fiscalYearStartMonth")}
            state={s}
            defaultValue={String(settings.fiscalYearStartMonth)}
            options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
          />
        </div>
      )}
    </ActionForm>
  );
}
