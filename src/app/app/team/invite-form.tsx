"use client";

import { useTranslations } from "next-intl";
import { ActionForm, Field, SelectField } from "@/components/form";
import { inviteAction } from "@/modules/iam/actions";

export function InviteForm({ roles }: { roles: string[] }) {
  const t = useTranslations();
  return (
    <ActionForm action={inviteAction} submitLabel={t("team.send")} resetOnSuccess className="grid items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
      {(state) => (
        <>
          <Field name="email" type="email" label={t("common.email")} state={state} required />
          <SelectField name="roleKey" label={t("team.role")} state={state} options={roles.map((r) => ({ value: r, label: t(`roles.${r}`) }))} />
        </>
      )}
    </ActionForm>
  );
}
