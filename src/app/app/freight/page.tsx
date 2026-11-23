import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, Table, Td, statusTone } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { hasPermission } from "@/modules/iam/rbac";
import { requirePagePermission } from "@/modules/iam/session-context";
import { formatMoney, placeLabel } from "@/modules/odf/format";
import { toTariffValues } from "@/modules/odf/pricing";
import { listOwnRequests, listTariffs } from "@/modules/odf/services/freight.service";
import { FreightRequestForm } from "./request-form";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("freight") };
}

export default async function FreightPage() {
  const ctx = await requirePagePermission("odf.requests.read");
  const t = await getTranslations();
  const locale = await getLocale();
  const [requests, tariffs] = await Promise.all([listOwnRequests(ctx), listTariffs()]);
  const tariffMap = Object.fromEntries(tariffs.filter((x) => x.active).map((x) => [x.category, toTariffValues(x)]));
  return (
    <div className="odf">
      <p className="mb-3 rounded bg-[#0b1d3a] px-3 py-1 text-center text-[11px] font-bold tracking-widest text-[#f2c35b]">
        {t("odf.demoBanner")}
      </p>
      <PageHeader title={t("odf.title")} description={t("odf.desc")} />
      {hasPermission(ctx, "odf.requests.manage") && (
        <Card className="mb-8">
          <h2 className="mb-4 text-lg font-extrabold text-[#0b1d3a]">{t("odf.newRequest")}</h2>
          <FreightRequestForm tariffs={tariffMap} />
        </Card>
      )}
      <h2 className="mb-3 text-lg font-extrabold text-[#0b1d3a]">{t("odf.requests")}</h2>
      {requests.length === 0 ? (
        <EmptyState title={t("odf.empty")} description={t("odf.emptyDesc")} />
      ) : (
        <Table
          head={[
            t("odf.reference"),
            t("odf.route"),
            t("odf.vehicle"),
            t("odf.price"),
            t("odf.provider"),
            t("odf.created"),
            t("odf.statusLabel"),
          ]}
        >
          {requests.map((r) => (
            <tr key={r.id}>
              <Td>
                <Link href={`/app/freight/${r.id}`} className="text-navy-900 font-mono font-medium hover:underline">
                  {r.reference}
                </Link>
              </Td>
              <Td>
                {placeLabel(t, r.pickupLabel)} → {placeLabel(t, r.dropoffLabel)}
              </Td>
              <Td>{t(`odf.categories.${r.category}`)}</Td>
              <Td className="odf-data">{formatMoney(r.price, r.currency, locale)}</Td>
              <Td>{r.provider ? `${r.provider.name} · ${r.vehicle?.plate ?? ""}` : "—"}</Td>
              <Td>{formatDateTime(r.createdAt, locale)}</Td>
              <Td>
                <Badge tone={statusTone(r.status)}>{t(`odf.status.${r.status}`)}</Badge>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
