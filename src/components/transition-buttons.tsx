"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import type { ActionState } from "@/modules/iam/action-result";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Um formulário por transição permitida, com a transição num campo oculto
 * (não depende do botão submissor). O servidor revalida sempre estado e permissões.
 */
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
  return (
    <div className="space-y-2">
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {t.has(state.error) ? t(state.error) : state.error}
        </p>
      )}
      <div className="flex flex-wrap items-start gap-2">
        {transitions.map((x) => (
          <form key={x} action={formAction} className="flex flex-wrap items-center gap-2">
            {Object.entries(fields).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <input type="hidden" name="transition" value={x} />
            {reasonFor.includes(x) && (
              <Input name="reason" placeholder={t("common.reason")} aria-label={t("common.reason")} />
            )}
            {size === "sm" ? (
              <button
                type="submit"
                disabled={pending}
                className={`text-xs hover:underline disabled:opacity-50 ${danger.includes(x) ? "text-red-700" : "text-navy-800"}`}
              >
                {t(`${labelPrefix}.${x}`)}
              </button>
            ) : (
              <Button type="submit" disabled={pending} variant={danger.includes(x) ? "danger" : "gold"}>
                {t(`${labelPrefix}.${x}`)}
              </Button>
            )}
          </form>
        ))}
      </div>
    </div>
  );
}
