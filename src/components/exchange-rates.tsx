"use client";

import { useTranslations } from "next-intl";
import { ActionForm, Field } from "@/components/form";
import { setExchangeRateAction } from "@/modules/platform/actions";

export function ExchangeRateForm({ scope }: { scope: "platform" | "organization" }) {
  const t = useTranslations();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ActionForm action={setExchangeRateAction} submitLabel={t("fx.add")} resetOnSuccess className="grid items-end gap-3 md:grid-cols-6">
      {(s) => (
        <>
          <input type="hidden" name="scope" value={scope} />
          <Field name="baseCurrency" label={t("fx.base")} state={s} defaultValue="USD" required />
          <Field name="quoteCurrency" label={t("fx.quote")} state={s} defaultValue="AOA" required />
          <Field name="rate" type="text" label={t("fx.rate")} state={s} placeholder="0.00" required />
          <Field name="effectiveDate" type="date" label={t("fx.effectiveDate")} state={s} defaultValue={today} required />
          <Field name="source" label={t("fx.source")} state={s} />
        </>
      )}
    </ActionForm>
  );
}
