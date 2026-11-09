"use client";

import { useTranslations } from "next-intl";
import { ActionForm, Field, SelectField } from "@/components/form";
import { addVerificationAction, createPartnerAction, updatePartnerAction } from "@/modules/mkt/actions";
import { PARTNER_TYPES, VERIFICATION_KINDS } from "@/modules/mkt/schemas";

type Partner = {
  id: string;
  type: string;
  name: string;
  nif: string | null;
  country: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export function PartnerForm({ partner }: { partner?: Partner }) {
  const t = useTranslations();
  return (
    <ActionForm
      action={partner ? updatePartnerAction : createPartnerAction}
      submitLabel={partner ? t("common.save") : t("partners.new")}
      resetOnSuccess={!partner}
    >
      {(s) => (
        <div className="grid gap-4 md:grid-cols-3">
          {partner && <input type="hidden" name="id" value={partner.id} />}
          <SelectField
            name="type"
            label={t("common.type")}
            state={s}
            defaultValue={partner?.type ?? "TRANSPORTER"}
            options={PARTNER_TYPES.map((v) => ({ value: v, label: t(`partners.type.${v}`) }))}
          />
          <Field name="name" label={t("common.name")} state={s} defaultValue={partner?.name} required />
          <Field name="nif" label={t("partners.nif")} state={s} defaultValue={partner?.nif} />
          <Field
            name="country"
            label={t("common.country")}
            state={s}
            defaultValue={partner?.country ?? "AO"}
            required
          />
          <Field name="email" type="email" label={t("common.email")} state={s} defaultValue={partner?.email} />
          <Field name="phone" label={t("common.phone")} state={s} defaultValue={partner?.phone} />
          <div className="md:col-span-3">
            <Field name="notes" label={t("partners.notes")} state={s} defaultValue={partner?.notes} />
          </div>
        </div>
      )}
    </ActionForm>
  );
}

export function VerificationForm({ partnerId }: { partnerId: string }) {
  const t = useTranslations();
  return (
    <ActionForm action={addVerificationAction} submitLabel={t("partners.addVerification")} resetOnSuccess>
      {(s) => (
        <div className="grid gap-4 md:grid-cols-3">
          <input type="hidden" name="id" value={partnerId} />
          <SelectField
            name="kind"
            label={t("partners.kind")}
            state={s}
            options={VERIFICATION_KINDS.map((v) => ({ value: v, label: t(`partners.kinds.${v}`) }))}
          />
          <Field name="expiresAt" type="date" label={t("partners.expiresAt")} state={s} />
          <Field name="notes" label={t("partners.notes")} state={s} />
        </div>
      )}
    </ActionForm>
  );
}
