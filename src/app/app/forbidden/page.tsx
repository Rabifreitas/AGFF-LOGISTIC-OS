import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";

export default async function ForbiddenPage() {
  const t = await getTranslations("forbidden");
  return (
    <Card className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold text-red-700">{t("title")}</h1>
      <p className="mt-2 text-sm text-gray-600">{t("desc")}</p>
    </Card>
  );
}
