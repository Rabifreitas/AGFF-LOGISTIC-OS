"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import type { ActionState } from "@/modules/iam/action-result";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ActionButton({
  action,
  fields,
  label,
  variant = "primary",
  className,
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  variant?: "primary" | "gold" | "danger" | "secondary";
  className?: string;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Button type="submit" variant={variant} disabled={pending} className="w-full">
        {label}
      </Button>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {t.has(state.error) ? t(state.error) : state.error}
        </p>
      )}
    </form>
  );
}

/** Revalida a página periodicamente enquanto há estado vivo (procura, corrida em curso). */
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

export function useSecondsLeft(expiresAt: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
}
