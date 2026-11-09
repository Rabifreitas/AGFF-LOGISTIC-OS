import { getTranslations } from "next-intl/server";
import { ExchangeRateTable } from "@/components/exchange-rate-table";
import { ExchangeRateForm } from "@/components/exchange-rates";
import { Card, PageHeader } from "@/components/ui";
import { listExchangeRates } from "@/modules/fin/services/exchange-rate.service";
import { hasPermission } from "@/modules/iam/rbac";
import { requirePagePermission } from "@/modules/iam/session-context";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("exchangeRates") };
}

export default async function ExchangeRatesPage() {
  const ctx = await requirePagePermission("exchange_rates.read");
  const t = await getTranslations("fx");
  const rates = await listExchangeRates(ctx);
  return (
    <>
      <PageHeader title={t("title")} description={t("desc")} />
      {hasPermission(ctx, "fin.exchange_rates.manage") && (
        <Card className="mb-6">
          <ExchangeRateForm scope="organization" />
        </Card>
      )}
      <ExchangeRateTable rates={rates} />
    </>
  );
}
