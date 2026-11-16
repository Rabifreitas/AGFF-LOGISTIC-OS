import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Badge, EmptyState, PageHeader, Table, Td, statusTone } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { requirePagePermission } from "@/modules/iam/session-context";
import { listOwnBids } from "@/modules/mkt/services/auction.service";

export async function generateMetadata() {
  const t = await getTranslations("mkt");
  return { title: t("myBids") };
}

export default async function MyBidsPage() {
  const ctx = await requirePagePermission("mkt.bids.read");
  const t = await getTranslations();
  const locale = await getLocale();
  const bids = await listOwnBids(ctx);
  const fmt = (v: unknown) => Number(v).toLocaleString(locale, { maximumFractionDigits: 2 });
  return (
    <>
      <PageHeader title={t("mkt.myBids")} description={t("mkt.myBidsDesc")} />
      {bids.length === 0 ? (
        <EmptyState title={t("mkt.noMyBids")} description={t("mkt.market.desc")} />
      ) : (
        <Table
          head={[
            t("mkt.reference"),
            t("mkt.route"),
            t("mkt.amount"),
            t("mkt.closesAt"),
            t("mkt.auctionLabel"),
            t("common.status"),
          ]}
        >
          {bids.map((b) => (
            <tr key={b.id}>
              <Td>
                <Link href={`/app/marketplace/${b.auction.id}`} className="font-mono hover:underline">
                  {b.auction.reference}
                </Link>
              </Td>
              <Td>
                {b.auction.originCity ?? b.auction.originCountry} →{" "}
                {b.auction.destinationCity ?? b.auction.destinationCountry}
              </Td>
              <Td className="font-mono">
                {b.currency} {fmt(b.amount)}
              </Td>
              <Td>{formatDateTime(b.auction.closesAt, locale)}</Td>
              <Td>
                <Badge tone={statusTone(b.auction.status)}>{t(`mkt.status.${b.auction.status}`)}</Badge>
              </Td>
              <Td>
                <Badge tone={statusTone(b.status)}>{t(`mkt.bidStatus.${b.status}`)}</Badge>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
