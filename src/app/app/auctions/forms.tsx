"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { ActionForm, CheckboxGroup, Field, SelectField } from "@/components/form";
import { Button } from "@/components/ui";
import type { ActionState } from "@/modules/iam/action-result";
import { awardAuctionAction, cancelAuctionAction, createAuctionAction } from "@/modules/mkt/auction-actions";
import { AUCTION_CURRENCIES } from "@/modules/mkt/auction-schemas";
import { LOGISTICS_SERVICES, TRANSPORT_MODES } from "@/modules/shp/schemas";

export function PublishAuctionForm({
  shipmentId,
  mode,
  services,
  defaultClosesAt,
}: {
  shipmentId: string;
  mode: string;
  services: string[];
  defaultClosesAt: string;
}) {
  const t = useTranslations();
  return (
    <ActionForm action={createAuctionAction} submitLabel={t("mkt.publish")} variant="gold">
      {(s) => (
        <div className="grid gap-4 md:grid-cols-3">
          <input type="hidden" name="shipmentId" value={shipmentId} />
          <Field
            name="closesAt"
            type="datetime-local"
            label={t("mkt.closesAt")}
            state={s}
            defaultValue={defaultClosesAt}
            required
          />
          <SelectField
            name="currency"
            label={t("mkt.currency")}
            state={s}
            defaultValue="USD"
            options={AUCTION_CURRENCIES.map((c) => ({ value: c, label: c }))}
          />
          <Field name="publicNotes" label={t("mkt.publicNotes")} state={s} />
          <div className="md:col-span-3">
            <CheckboxGroup
              name="modes"
              label={t("mkt.acceptedModes")}
              state={s}
              defaultValues={mode === "MULTIMODAL" ? [] : [mode]}
              options={TRANSPORT_MODES.map((v) => ({ value: v, label: t(`shp.modes.${v}`) }))}
            />
          </div>
          <div className="md:col-span-3">
            <CheckboxGroup
              name="services"
              label={t("mkt.requiredServices")}
              state={s}
              defaultValues={services}
              options={LOGISTICS_SERVICES.map((v) => ({ value: v, label: t(`shp.services.${v}`) }))}
            />
          </div>
          <p className="text-sm text-gray-600 md:col-span-3">{t("mkt.anonymityNote")}</p>
        </div>
      )}
    </ActionForm>
  );
}

function SmallAction({
  action,
  fields,
  label,
  variant,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  label: string;
  variant: "gold" | "danger" | "secondary";
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Button type="submit" variant={variant} disabled={pending}>
        {label}
      </Button>
      {state.error && (
        <span role="alert" className="text-xs text-red-700">
          {t.has(state.error) ? t(state.error) : state.error}
        </span>
      )}
    </form>
  );
}

export function AwardButton({ auctionId, bidId }: { auctionId: string; bidId: string }) {
  const t = useTranslations();
  return (
    <SmallAction
      action={awardAuctionAction}
      fields={{ id: auctionId, bidId }}
      label={t("mkt.awardBid")}
      variant="gold"
    />
  );
}

export function CancelAuctionButton({ auctionId }: { auctionId: string }) {
  const t = useTranslations();
  return (
    <SmallAction action={cancelAuctionAction} fields={{ id: auctionId }} label={t("mkt.cancel")} variant="danger" />
  );
}
