import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ExchangeRateTable } from "@/components/exchange-rate-table";
import { ExchangeRateForm } from "@/components/exchange-rates";
import { Card, PageHeader } from "@/components/ui";
import { listExchangeRates } from "@/modules/fin/services/exchange-rate.service";
import { hasPermission } from "@/modules/iam/rbac";
import { requireActor } from "@/modules/iam/session-context";

export default async function AdminExchangeRatesPage() {
  const ctx = await requireActor();
  if (!hasPermission(ctx, "platform.exchange_rates.manage")) redirect("/app/forbidden");
  const t = await getTranslations();
  const rates = (await listExchangeRates(ctx)).filter((r) => r.organizationId === null);
  return (
    <>
      <PageHeader title={t("admin.platformRates")} description={t("fx.desc")} />
      <Card className="mb-6">
        <ExchangeRateForm scope="platform" />
      </Card>
      <ExchangeRateTable rates={rates} />
    </>
  );
}
