"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import type { ActionState } from "@/modules/iam/action-result";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** Um botão por transição permitida; o servidor revalida sempre estado e permissões. */
export function TransitionButtons({
  action,
  fields,
  transitions,
  labelPrefix,
  danger = [],
  reasonFor = [],
  size = "md",
}: {
  action: Action;
  fields: Record<string, string>;
  transitions: string[];
  labelPrefix: string;
  danger?: string[];
  reasonFor?: string[];
  size?: "sm" | "md";
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, {});
  if (transitions.length === 0) return null;
  const needsReason = transitions.some((x) => reasonFor.includes(x));
  return (
    <form action={formAction} className="space-y-2">
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {t.has(state.error) ? t(state.error) : state.error}
        </p>
      )}
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {needsReason && <Input name="reason" placeholder={t("common.reason")} aria-label={t("common.reason")} />}
      <div className="flex flex-wrap gap-2">
        {transitions.map((x) =>
          size === "sm" ? (
            <button
              key={x}
              name="transition"
              value={x}
              disabled={pending}
              className={`text-xs hover:underline disabled:opacity-50 ${danger.includes(x) ? "text-red-700" : "text-navy-800"}`}
            >
              {t(`${labelPrefix}.${x}`)}
            </button>
          ) : (
            <Button
              key={x}
              name="transition"
              value={x}
              disabled={pending}
              variant={danger.includes(x) ? "danger" : "gold"}
            >
              {t(`${labelPrefix}.${x}`)}
            </Button>
          ),
        )}
      </div>
    </form>
  );
}
