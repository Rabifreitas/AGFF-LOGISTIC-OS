"use client";

import { useTranslations } from "next-intl";
import { ActionForm, Field, SelectField } from "@/components/form";
import { rateFreightAction } from "@/modules/odf/actions";

export function RatingForm({ id }: { id: string }) {
  const t = useTranslations("odf");
  return (
    <ActionForm action={rateFreightAction} submitLabel={t("rate")} variant="gold">
      {(s) => (
        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <input type="hidden" name="id" value={id} />
          <SelectField
            name="rating"
            label={t("rating")}
            state={s}
            defaultValue="5"
            options={["5", "4", "3", "2", "1"].map((v) => ({ value: v, label: `${v} ★` }))}
          />
          <Field name="comment" label={t("comment")} state={s} />
        </div>
      )}
    </ActionForm>
  );
}
