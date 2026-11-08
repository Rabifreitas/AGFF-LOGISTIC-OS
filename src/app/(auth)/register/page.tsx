import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Registar empresa" };

export default async function RegisterPage() {
  const t = await getTranslations("register");
  return (
    <Card className="w-full max-w-2xl">
      <h1 className="text-navy-900 text-xl font-semibold">{t("title")}</h1>
      <p className="mt-1 mb-6 text-sm text-gray-600">{t("subtitle")}</p>
      <RegisterForm />
      <p className="mt-6 text-sm text-gray-600">
        {t("haveAccount")}{" "}
        <Link href="/login" className="text-gold-600 font-medium hover:underline">
          Login
        </Link>
      </p>
    </Card>
  );
}
