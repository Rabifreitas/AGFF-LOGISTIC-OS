"use client";

import { useTranslations } from "next-intl";
import { ActionForm, Field } from "@/components/form";
import { loginAction } from "@/modules/iam/actions";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations();
  return (
    <ActionForm action={loginAction} submitLabel={t("login.submit")}>
      {(state) => (
        <>
          <input type="hidden" name="next" value={next ?? "/app"} />
          <Field name="email" type="email" label={t("common.email")} state={state} autoComplete="email" required />
          <Field
            name="password"
            type="password"
            label={t("login.password")}
            state={state}
            autoComplete="current-password"
            required
          />
        </>
      )}
    </ActionForm>
  );
}
