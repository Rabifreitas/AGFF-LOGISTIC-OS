import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { findValidResetToken } from "@/modules/iam/services/password.service";
import { ResetForm } from "./reset-form";

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("reset");
  const valid = await findValidResetToken(token);
  return (
    <Card className="w-full max-w-md">
      <h1 className="mb-6 text-xl font-semibold text-navy-900">{t("title")}</h1>
      {valid ? (
        <ResetForm token={token} />
      ) : (
        <p className="text-sm text-red-700">
          {t("invalidToken")}{" "}
          <Link href="/forgot-password" className="underline">
            →
          </Link>
        </p>
      )}
    </Card>
  );
}
