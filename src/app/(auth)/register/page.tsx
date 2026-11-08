import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Registar empresa" };

export default async function RegisterPage() {
  const t = await getTranslations("register");
  return (
    <Card className="w-full max-w-2xl">
      <h1 className="text-xl font-semibold text-navy-900">{t("title")}</h1>
      <p className="mb-6 mt-1 text-sm text-gray-600">{t("subtitle")}</p>
      <RegisterForm />
      <p className="mt-6 text-sm text-gray-600">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-gold-600 hover:underline">
          Login
        </Link>
      </p>
    </Card>
  );
}
