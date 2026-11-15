"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { reviewProviderAction } from "@/modules/mkt/auction-actions";

export function ProviderReviewForm({ id, decisions }: { id: string; decisions: string[] }) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(reviewProviderAction, {});
  if (decisions.length === 0) return null;
  return (
    <div className="space-y-2">
      {decisions.map((d) => (
        <form key={d} action={formAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value={d} />
          {(d === "verify" || d === "reactivate") && (
            <Input name="validUntil" type="date" aria-label={t("mkt.validUntil")} className="w-40" />
          )}
          {(d === "reject" || d === "suspend") && (
            <Input
              name="reason"
              placeholder={t("mkt.provider.reason")}
              aria-label={t("mkt.provider.reason")}
              className="w-48"
            />
          )}
          <Button type="submit" variant={d === "reject" || d === "suspend" ? "danger" : "gold"} disabled={pending}>
            {t(`mkt.providerReview.${d}`)}
          </Button>
        </form>
      ))}
      {state.error && (
        <p role="alert" className="text-xs text-red-700">
          {t.has(state.error) ? t(state.error) : state.error}
        </p>
      )}
    </div>
  );
}
