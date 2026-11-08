import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { getCurrentSession } from "@/modules/iam/session-context";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  if (await getCurrentSession()) redirect("/app");
  const { next, reset } = await searchParams;
  const t = await getTranslations("login");
  return (
    <Card className="w-full max-w-md">
      <h1 className="text-navy-900 text-xl font-semibold">{t("title")}</h1>
      <p className="mt-1 mb-6 text-sm text-gray-600">{t("subtitle")}</p>
      {reset && <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{t("resetDone")}</p>}
      <LoginForm next={next?.startsWith("/") ? next : undefined} />
      <div className="mt-6 flex justify-between text-sm">
        <Link href="/forgot-password" className="text-navy-700 hover:underline">
          {t("forgot")}
        </Link>
        <span className="text-gray-600">
          {t("noAccount")}{" "}
          <Link href="/register" className="text-gold-600 font-medium hover:underline">
            {t("register")}
          </Link>
        </span>
      </div>
    </Card>
  );
}
