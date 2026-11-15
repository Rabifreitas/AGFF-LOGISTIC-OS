"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { ActionForm, CheckboxGroup, Field } from "@/components/form";
import { Button } from "@/components/ui";
import { saveProviderProfileAction, submitProviderProfileAction } from "@/modules/mkt/auction-actions";
import { LOGISTICS_SERVICES, TRANSPORT_MODES } from "@/modules/shp/schemas";

export function ProviderProfileForm({
  profile,
}: {
  profile: { modes: string[]; services: string[]; countries: string[]; description: string | null } | null;
}) {
  const t = useTranslations();
  return (
    <ActionForm action={saveProviderProfileAction} submitLabel={t("common.save")}>
      {(s) => (
        <div className="grid gap-4">
          <CheckboxGroup
            name="modes"
            label={t("mkt.provider.modes")}
            state={s}
            defaultValues={profile?.modes ?? []}
            options={TRANSPORT_MODES.map((v) => ({ value: v, label: t(`shp.modes.${v}`) }))}
          />
          <CheckboxGroup
            name="services"
            label={t("mkt.provider.services")}
            state={s}
            defaultValues={profile?.services ?? []}
            options={LOGISTICS_SERVICES.map((v) => ({ value: v, label: t(`shp.services.${v}`) }))}
          />
          <Field
            name="countries"
            label={t("mkt.provider.countries")}
            placeholder="AO, CD, NA, ZM"
            state={s}
            defaultValue={profile?.countries.join(", ")}
          />
          <Field
            name="description"
            label={t("mkt.provider.description")}
            state={s}
            defaultValue={profile?.description}
          />
        </div>
      )}
    </ActionForm>
  );
}

export function SubmitProviderButton() {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(submitProviderProfileAction, {});
  return (
    <form action={formAction}>
      <Button type="submit" variant="gold" disabled={pending}>
        {t("mkt.provider.submit")}
      </Button>
      {state.error && (
        <p role="alert" className="text-xs text-red-700">
          {t.has(state.error) ? t(state.error) : state.error}
        </p>
      )}
    </form>
  );
}
