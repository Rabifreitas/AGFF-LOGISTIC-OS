"use client";

import { useTranslations } from "next-intl";
import { ActionForm, Field } from "@/components/form";
import { resetPasswordAction } from "@/modules/iam/actions";

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations();
  return (
    <ActionForm action={resetPasswordAction} submitLabel={t("reset.submit")}>
      {(state) => (
        <>
          <input type="hidden" name="token" value={token} />
          <Field name="password" type="password" label={t("reset.password")} state={state} autoComplete="new-password" required />
          <Field name="confirmPassword" type="password" label={t("reset.confirmPassword")} state={state} autoComplete="new-password" required />
          <p className="text-xs text-gray-500">{t("register.passwordHint")}</p>
        </>
      )}
    </ActionForm>
  );
}
