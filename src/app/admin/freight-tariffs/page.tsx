import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { hasPermission } from "@/modules/iam/rbac";
import { requireActor } from "@/modules/iam/session-context";
import { VEHICLE_CATEGORIES } from "@/modules/odf/rules";
import { listTariffs } from "@/modules/odf/services/freight.service";
import { TariffForm } from "./tariff-form";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("freightTariffs") };
}

export default async function FreightTariffsPage() {
  const ctx = await requireActor();
  if (!hasPermission(ctx, "platform.freight_tariffs.manage")) redirect("/app/forbidden");
  const t = await getTranslations("odf");
  const tariffs = new Map((await listTariffs()).map((x) => [x.category, x]));
  const s = (v: unknown) => (v == null ? "" : String(v));
  return (
    <>
      <PageHeader title={t("tariffs.title")} description={t("tariffs.desc")} />
      <div className="space-y-4">
        {VEHICLE_CATEGORIES.map((c) => {
          const x = tariffs.get(c);
          return (
            <Card key={c}>
              <h2 className="text-navy-900 mb-1 font-semibold">{t(`categories.${c}`)}</h2>
              <p className="mb-3 text-xs text-gray-500">{t(`categoryHints.${c}`)} · AOA</p>
              <TariffForm
                category={c}
                values={{
                  baseFee: s(x?.baseFee),
                  perKm: s(x?.perKm),
                  minimumFee: s(x?.minimumFee),
                  stevedoreFee: s(x?.stevedoreFee),
                  waybillFee: s(x?.waybillFee),
                  insuranceRatePct: s(x?.insuranceRatePct),
                  active: x?.active ?? true,
                }}
              />
            </Card>
          );
        })}
      </div>
    </>
  );
}
