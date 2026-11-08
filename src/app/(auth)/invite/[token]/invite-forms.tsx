"use client";

import { useTranslations } from "next-intl";
import { ActionForm, Field } from "@/components/form";
import { acceptInviteExistingUserAction, acceptInviteNewUserAction } from "@/modules/iam/actions";

export function NewUserInviteForm({ token, email }: { token: string; email: string }) {
  const t = useTranslations();
  return (
    <ActionForm action={acceptInviteNewUserAction} submitLabel={t("invites.createAccount")} variant="gold">
      {(state) => (
        <>
          <input type="hidden" name="token" value={token} />
          <p className="text-sm text-gray-700">
            {t("common.email")}: <strong>{email}</strong>
          </p>
          <Field name="name" label={t("register.adminName")} state={state} autoComplete="name" required />
          <Field
            name="password"
            type="password"
            label={t("register.password")}
            state={state}
            autoComplete="new-password"
            required
          />
          <p className="text-xs text-gray-500">{t("register.passwordHint")}</p>
        </>
      )}
    </ActionForm>
  );
}

export function ExistingUserInviteForm({ token }: { token: string }) {
  const t = useTranslations();
  return (
    <ActionForm action={acceptInviteExistingUserAction} submitLabel={t("invites.accept")} variant="gold">
      {() => <input type="hidden" name="token" value={token} />}
    </ActionForm>
  );
}
