"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { transitionOrganizationAction } from "@/modules/platform/actions";

export function TransitionForm({ organizationId, transitions }: { organizationId: string; transitions: string[] }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(transitionOrganizationAction, {});
  if (transitions.length === 0) return null;
  const needsReason = transitions.some((x) => x === "reject" || x === "suspend");
  return (
    <form action={action} className="space-y-3">
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {t.has(state.error) ? t(state.error) : state.error}
        </p>
      )}
      <input type="hidden" name="organizationId" value={organizationId} />
      {needsReason && <Input name="reason" placeholder={t("admin.reason")} aria-label={t("admin.reason")} />}
      <div className="flex flex-wrap gap-2">
        {transitions.map((x) => (
          <Button
            key={x}
            name="transition"
            value={x}
            disabled={pending}
            variant={x === "approve" || x === "reactivate" ? "gold" : "danger"}
          >
            {t(`admin.transition.${x}`)}
          </Button>
        ))}
      </div>
    </form>
  );
}
