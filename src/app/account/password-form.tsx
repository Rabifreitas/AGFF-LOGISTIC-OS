"use client";

import { useTranslations } from "next-intl";
import { ActionForm, Field } from "@/components/form";
import { changePasswordAction } from "@/modules/iam/actions";

export function PasswordForm() {
  const t = useTranslations();
  return (
    <ActionForm action={changePasswordAction} submitLabel={t("common.save")} resetOnSuccess>
      {(s) => (
        <div className="grid gap-4 md:grid-cols-3">
          <Field name="currentPassword" type="password" label={t("account.currentPassword")} state={s} autoComplete="current-password" required />
          <Field name="password" type="password" label={t("reset.password")} state={s} autoComplete="new-password" required />
          <Field name="confirmPassword" type="password" label={t("reset.confirmPassword")} state={s} autoComplete="new-password" required />
        </div>
      )}
    </ActionForm>
  );
}
