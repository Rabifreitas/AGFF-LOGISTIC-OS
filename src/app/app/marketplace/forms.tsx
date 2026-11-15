"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { ActionForm, Field, SelectField } from "@/components/form";
import { Button } from "@/components/ui";
import { placeBidAction, withdrawBidAction } from "@/modules/mkt/auction-actions";

export function BidForm({
  auctionId,
  modes,
  currency,
  current,
}: {
  auctionId: string;
  modes: string[];
  currency: string;
  current: {
    amount: string;
    mode: string;
    transitDays: number;
    validUntil: string | null;
    notes: string | null;
  } | null;
}) {
  const t = useTranslations();
  return (
    <ActionForm action={placeBidAction} submitLabel={current ? t("mkt.updateBid") : t("mkt.submitBid")} variant="gold">
      {(s) => (
        <div className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="id" value={auctionId} />
          <Field
            name="amount"
            type="number"
            label={`${t("mkt.amount")} (${currency})`}
            state={s}
            defaultValue={current?.amount}
            required
          />
          <SelectField
            name="mode"
            label={t("mkt.mode")}
            state={s}
            defaultValue={current?.mode ?? modes[0]}
            options={modes.map((m) => ({ value: m, label: t(`shp.modes.${m}`) }))}
          />
          <Field
            name="transitDays"
            type="number"
            label={t("mkt.transitDays")}
            state={s}
            defaultValue={current?.transitDays}
            required
          />
          <Field
            name="validUntil"
            type="datetime-local"
            label={t("mkt.validUntil")}
            state={s}
            defaultValue={current?.validUntil}
          />
          <div className="md:col-span-2">
            <Field name="notes" label={t("mkt.bidNotes")} state={s} defaultValue={current?.notes} />
          </div>
        </div>
      )}
    </ActionForm>
  );
}

export function WithdrawBidButton({ auctionId }: { auctionId: string }) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(withdrawBidAction, {});
  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="id" value={auctionId} />
      <Button type="submit" variant="danger" disabled={pending}>
        {t("mkt.withdrawBid")}
      </Button>
      {state.error && (
        <p role="alert" className="text-xs text-red-700">
          {t.has(state.error) ? t(state.error) : state.error}
        </p>
      )}
    </form>
  );
}
