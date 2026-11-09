"use client";

import { useTranslations } from "next-intl";
import { ActionForm, Field, SelectField } from "@/components/form";
import { Label } from "@/components/ui";
import { addItemAction, addStopAction, createShipmentAction, updateShipmentAction } from "@/modules/shp/actions";
import { INCOTERMS, STOP_TYPES, TRANSPORT_MODES } from "@/modules/shp/schemas";
import { openIncidentAction, recordTrackingEventAction } from "@/modules/trk/actions";
import { INCIDENT_SEVERITIES } from "@/modules/trk/schemas";
import { TRACKING_CODES } from "@/modules/trk/tracking-codes";

type Option = { value: string; label: string };
export type ShipmentFormValues = {
  id: string;
  mode: string;
  incoterm: string | null;
  customerPartnerId: string | null;
  carrierPartnerId: string | null;
  costCenterId: string | null;
  plannedPickupAt: string | null;
  plannedDeliveryAt: string | null;
  currency: string;
  declaredValue: string | null;
  notes: string | null;
};

export function ShipmentForm({
  shipment,
  customers,
  carriers,
  costCenters,
  defaultCurrency,
}: {
  shipment?: ShipmentFormValues;
  customers: Option[];
  carriers: Option[];
  costCenters: Option[];
  defaultCurrency: string;
}) {
  const t = useTranslations();
  const none = { value: "", label: t("common.none") };
  return (
    <ActionForm
      action={shipment ? updateShipmentAction : createShipmentAction}
      submitLabel={shipment ? t("common.save") : t("shp.new")}
      resetOnSuccess={!shipment}
    >
      {(s) => (
        <div className="grid gap-4 md:grid-cols-3">
          {shipment && <input type="hidden" name="id" value={shipment.id} />}
          <SelectField
            name="mode"
            label={t("shp.mode")}
            state={s}
            defaultValue={shipment?.mode ?? "ROAD"}
            options={TRANSPORT_MODES.map((v) => ({ value: v, label: t(`shp.modes.${v}`) }))}
          />
          <SelectField
            name="incoterm"
            label={t("shp.incoterm")}
            state={s}
            defaultValue={shipment?.incoterm ?? ""}
            options={[none, ...INCOTERMS.map((v) => ({ value: v, label: v }))]}
          />
          <SelectField
            name="customerPartnerId"
            label={t("shp.customer")}
            state={s}
            defaultValue={shipment?.customerPartnerId ?? ""}
            options={[none, ...customers]}
          />
          <SelectField
            name="carrierPartnerId"
            label={t("shp.carrier")}
            state={s}
            defaultValue={shipment?.carrierPartnerId ?? ""}
            options={[none, ...carriers]}
          />
          <SelectField
            name="costCenterId"
            label={t("shp.costCenter")}
            state={s}
            defaultValue={shipment?.costCenterId ?? ""}
            options={[none, ...costCenters]}
          />
          <Field
            name="currency"
            label={t("common.currency")}
            state={s}
            defaultValue={shipment?.currency ?? defaultCurrency}
            required
          />
          <Field
            name="plannedPickupAt"
            type="datetime-local"
            label={t("shp.plannedPickupAt")}
            state={s}
            defaultValue={shipment?.plannedPickupAt}
          />
          <Field
            name="plannedDeliveryAt"
            type="datetime-local"
            label={t("shp.plannedDeliveryAt")}
            state={s}
            defaultValue={shipment?.plannedDeliveryAt}
          />
          <Field name="declaredValue" label={t("shp.declaredValue")} state={s} defaultValue={shipment?.declaredValue} />
          <div className="md:col-span-3">
            <Field name="notes" label={t("shp.notes")} state={s} defaultValue={shipment?.notes} />
          </div>
        </div>
      )}
    </ActionForm>
  );
}

export function StopForm({ shipmentId }: { shipmentId: string }) {
  const t = useTranslations();
  return (
    <ActionForm action={addStopAction} submitLabel={t("shp.addStop")} resetOnSuccess>
      {(s) => (
        <div className="grid gap-4 md:grid-cols-3">
          <input type="hidden" name="id" value={shipmentId} />
          <SelectField
            name="type"
            label={t("common.type")}
            state={s}
            options={STOP_TYPES.map((v) => ({ value: v, label: t(`shp.stopType.${v}`) }))}
          />
          <Field name="name" label={t("shp.stopName")} state={s} />
          <Field name="address" label={t("shp.address")} state={s} required />
          <Field name="city" label={t("shp.city")} state={s} />
          <Field name="country" label={t("common.country")} state={s} defaultValue="AO" required />
          <Field name="plannedAt" type="datetime-local" label={t("shp.plannedAt")} state={s} />
        </div>
      )}
    </ActionForm>
  );
}

export function ItemForm({ shipmentId }: { shipmentId: string }) {
  const t = useTranslations();
  return (
    <ActionForm action={addItemAction} submitLabel={t("shp.addItem")} resetOnSuccess>
      {(s) => (
        <div className="grid gap-4 md:grid-cols-3">
          <input type="hidden" name="id" value={shipmentId} />
          <div className="md:col-span-3">
            <Field name="description" label={t("shp.description")} state={s} required />
          </div>
          <Field name="quantity" label={t("shp.quantity")} state={s} defaultValue="1" required />
          <Field name="unit" label={t("shp.unit")} state={s} defaultValue="UN" required />
          <Field name="hsCode" label={t("shp.hsCode")} state={s} />
          <Field name="weightKg" label={t("shp.weightKg")} state={s} />
          <Field name="volumeM3" label={t("shp.volumeM3")} state={s} />
          <div className="flex items-center gap-2 pt-6">
            <input id="dangerousGoods" name="dangerousGoods" type="checkbox" className="h-4 w-4" />
            <Label htmlFor="dangerousGoods">{t("shp.dangerousGoods")}</Label>
          </div>
        </div>
      )}
    </ActionForm>
  );
}

export function TrackingEventForm({ shipmentId }: { shipmentId: string }) {
  const t = useTranslations();
  return (
    <ActionForm action={recordTrackingEventAction} submitLabel={t("trk.record")} resetOnSuccess variant="gold">
      {(s) => (
        <div className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="shipmentId" value={shipmentId} />
          <SelectField
            name="code"
            label={t("trk.code")}
            state={s}
            options={TRACKING_CODES.map((v) => ({ value: v, label: t(`trk.codes.${v}`) }))}
          />
          <Field name="occurredAt" type="datetime-local" label={t("trk.occurredAt")} state={s} />
          <div className="md:col-span-2">
            <Field name="description" label={t("shp.description")} state={s} />
          </div>
          <Field name="latitude" label={t("trk.latitude")} state={s} />
          <Field name="longitude" label={t("trk.longitude")} state={s} />
        </div>
      )}
    </ActionForm>
  );
}

export function IncidentForm({ shipments, shipmentId }: { shipments?: Option[]; shipmentId?: string }) {
  const t = useTranslations();
  return (
    <ActionForm action={openIncidentAction} submitLabel={t("incidents.new")} resetOnSuccess>
      {(s) => (
        <div className="grid gap-4 md:grid-cols-3">
          <input type="hidden" name="back" value={shipmentId ? `/app/shipments/${shipmentId}` : "/app/incidents"} />
          {shipmentId ? (
            <input type="hidden" name="shipmentId" value={shipmentId} />
          ) : (
            <SelectField
              name="shipmentId"
              label={t("incidents.shipment")}
              state={s}
              options={[{ value: "", label: t("common.none") }, ...(shipments ?? [])]}
            />
          )}
          <Field name="title" label={t("incidents.titleField")} state={s} required />
          <SelectField
            name="severity"
            label={t("incidents.severity")}
            state={s}
            defaultValue="MEDIUM"
            options={INCIDENT_SEVERITIES.map((v) => ({ value: v, label: t(`incidents.severities.${v}`) }))}
          />
          <div className="md:col-span-3">
            <Field name="description" label={t("incidents.description")} state={s} />
          </div>
        </div>
      )}
    </ActionForm>
  );
}
