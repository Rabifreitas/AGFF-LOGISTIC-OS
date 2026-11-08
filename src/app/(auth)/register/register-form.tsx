"use client";

import { useTranslations } from "next-intl";
import { ActionForm, Field, SelectField } from "@/components/form";
import { registerAction } from "@/modules/iam/actions";

const TYPES = ["SHIPPER", "TRANSPORTER", "FREIGHT_FORWARDER", "CUSTOMS_BROKER", "WAREHOUSE", "SUPPLIER", "OTHER"];

export function RegisterForm() {
  const t = useTranslations();
  return (
    <ActionForm action={registerAction} submitLabel={t("register.submit")} variant="gold">
      {(state) => (
        <>
          <fieldset className="space-y-4">
            <legend className="text-navy-900 mb-2 text-sm font-semibold">{t("register.company")}</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <Field name="companyName" label={t("register.companyName")} state={state} required />
              <Field name="legalName" label={t("register.legalName")} state={state} required />
              <Field name="nif" label={t("register.nif")} state={state} required />
              <SelectField
                name="organizationType"
                label={t("register.organizationType")}
                state={state}
                options={TYPES.map((v) => ({ value: v, label: t(`orgType.${v}`) }))}
              />
              <Field name="country" label={t("common.country")} state={state} defaultValue="AO" required />
              <Field name="currency" label={t("common.currency")} state={state} defaultValue="AOA" required />
              <Field name="companyEmail" type="email" label={t("register.companyEmail")} state={state} required />
              <Field name="companyPhone" label={t("register.companyPhone")} state={state} />
            </div>
          </fieldset>
          <fieldset className="space-y-4">
            <legend className="text-navy-900 mb-2 text-sm font-semibold">{t("register.admin")}</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <Field name="adminName" label={t("register.adminName")} state={state} autoComplete="name" required />
              <Field
                name="adminEmail"
                type="email"
                label={t("register.adminEmail")}
                state={state}
                autoComplete="email"
                required
              />
            </div>
            <Field
              name="password"
              type="password"
              label={t("register.password")}
              state={state}
              autoComplete="new-password"
              required
            />
            <p className="text-xs text-gray-500">{t("register.passwordHint")}</p>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" name="acceptTerms" className="mt-1" />
              {t("register.acceptTerms")}
            </label>
            {state.fieldErrors?.acceptTerms && <p className="text-xs text-red-600">{t("validation.acceptTerms")}</p>}
          </fieldset>
        </>
      )}
    </ActionForm>
  );
}
