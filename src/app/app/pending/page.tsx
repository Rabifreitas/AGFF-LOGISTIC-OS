import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { requireActor } from "@/modules/iam/session-context";

export default async function PendingPage() {
  const ctx = await requireActor();
  if (ctx.organizationStatus === "ACTIVE") redirect("/app");
  const t = await getTranslations("pending");
  return (
    <Card className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold text-navy-900">{t("title")}</h1>
      <p className="mt-2 text-sm text-gray-600">{t(ctx.organizationStatus as "PENDING_APPROVAL")}</p>
    </Card>
  );
}
