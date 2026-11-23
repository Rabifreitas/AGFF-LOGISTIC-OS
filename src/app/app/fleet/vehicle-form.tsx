"use client";

import { useTranslations } from "next-intl";
import { ActionForm, Field, SelectField } from "@/components/form";
import { saveVehicleAction } from "@/modules/odf/actions";
import { VEHICLE_CATEGORIES, VEHICLE_STATUSES } from "@/modules/odf/rules";

export type VehicleFormValues = {
  id?: string;
  plate?: string;
  category?: string;
  capacityKg?: string;
  description?: string;
  status?: string;
  driverUserId?: string;
};

export function VehicleForm({
  values = {},
  drivers,
}: {
  values?: VehicleFormValues;
  drivers: { id: string; name: string }[];
}) {
  const t = useTranslations("odf");
  return (
    <ActionForm
      action={saveVehicleAction}
      submitLabel={values.id ? t("fleet.save") : t("fleet.addVehicle")}
      variant={values.id ? "secondary" : "gold"}
      resetOnSuccess={!values.id}
    >
      {(s) => (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {values.id && <input type="hidden" name="id" value={values.id} />}
          <Field name="plate" label={t("plate")} state={s} defaultValue={values.plate} required />
          <SelectField
            name="category"
            label={t("vehicle")}
            state={s}
            defaultValue={values.category ?? "CONTAINER_TRUCK"}
            options={VEHICLE_CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) }))}
          />
          <Field name="capacityKg" label={t("fleet.capacityKg")} state={s} defaultValue={values.capacityKg} />
          <Field name="description" label={t("fleet.description")} state={s} defaultValue={values.description} />
          <SelectField
            name="status"
            label={t("fleet.status")}
            state={s}
            defaultValue={values.status ?? "ACTIVE"}
            options={VEHICLE_STATUSES.map((v) => ({ value: v, label: t(`vehicleStatus.${v}`) }))}
          />
          <SelectField
            name="driverUserId"
            label={t("fleet.driver")}
            state={s}
            defaultValue={values.driverUserId ?? ""}
            options={[
              { value: "", label: t("fleet.noDriver") },
              ...drivers.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
        </div>
      )}
    </ActionForm>
  );
}
