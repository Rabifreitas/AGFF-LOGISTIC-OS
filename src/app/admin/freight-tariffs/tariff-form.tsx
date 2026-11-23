"use client";

import { useTranslations } from "next-intl";
import { ActionForm, Field } from "@/components/form";
import { saveTariffAction } from "@/modules/odf/actions";

const FIELDS = ["baseFee", "perKm", "minimumFee", "stevedoreFee", "waybillFee", "insuranceRatePct"] as const;

export function TariffForm({
  category,
  values,
}: {
  category: string;
  values: Record<(typeof FIELDS)[number], string> & { active: boolean };
}) {
  const t = useTranslations("odf");
  return (
    <ActionForm action={saveTariffAction} submitLabel={t("tariffs.save")} variant="secondary">
      {(s) => (
        <>
          <input type="hidden" name="category" value={category} />
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {FIELDS.map((f) => (
              <Field key={f} name={f} label={t(`tariffs.${f}`)} state={s} defaultValue={values[f]} required />
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={values.active} /> {t("tariffs.active")}
          </label>
        </>
      )}
    </ActionForm>
  );
}
