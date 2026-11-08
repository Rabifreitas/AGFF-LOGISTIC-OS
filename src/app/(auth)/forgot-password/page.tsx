"use client";

import { useTranslations } from "next-intl";
import { ActionForm, Field } from "@/components/form";
import { Card } from "@/components/ui";
import { forgotPasswordAction } from "@/modules/iam/actions";

export default function ForgotPasswordPage() {
  const t = useTranslations();
  return (
    <Card className="w-full max-w-md">
      <h1 className="text-navy-900 text-xl font-semibold">{t("forgot.title")}</h1>
      <p className="mt-1 mb-6 text-sm text-gray-600">{t("forgot.subtitle")}</p>
      <ActionForm action={forgotPasswordAction} submitLabel={t("forgot.submit")}>
        {(state) => <Field name="email" type="email" label={t("common.email")} state={state} required />}
      </ActionForm>
    </Card>
  );
}
