import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Badge, EmptyState, PageHeader, Table, Td, statusTone } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { requirePagePermission } from "@/modules/iam/session-context";
import { listOwnAuctions } from "@/modules/mkt/services/auction.service";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("auctions") };
}

export default async function AuctionsPage() {
  const ctx = await requirePagePermission("mkt.auctions.read");
  const t = await getTranslations();
  const locale = await getLocale();
  const auctions = await listOwnAuctions(ctx);
  return (
    <>
      <PageHeader title={t("mkt.auctions.title")} description={t("mkt.auctions.desc")} />
      {auctions.length === 0 ? (
        <EmptyState title={t("mkt.auctions.empty")} description={t("mkt.auctions.emptyDesc")} />
      ) : (
        <Table
          head={[
            t("mkt.reference"),
            t("mkt.route"),
            t("nav.shipments"),
            t("mkt.closesAt"),
            t("mkt.bids"),
            t("common.status"),
          ]}
        >
          {auctions.map((a) => (
            <tr key={a.id}>
              <Td>
                <Link href={`/app/auctions/${a.id}`} className="text-navy-900 font-mono font-medium hover:underline">
                  {a.reference}
                </Link>
              </Td>
              <Td>
                {a.originCity ?? a.originCountry} → {a.destinationCity ?? a.destinationCountry}
              </Td>
              <Td className="font-mono">{a.shipment.reference}</Td>
              <Td>{formatDateTime(a.closesAt, locale)}</Td>
              <Td>{a.bidCount}</Td>
              <Td>
                <Badge tone={statusTone(a.status)}>{t(`mkt.status.${a.status}`)}</Badge>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
