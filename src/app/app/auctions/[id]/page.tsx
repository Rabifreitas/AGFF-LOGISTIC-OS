import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, Table, Td, statusTone } from "@/components/ui";
import { isAppError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/utils";
import { hasPermission } from "@/modules/iam/rbac";
import { requirePagePermission } from "@/modules/iam/session-context";
import { getOwnAuction } from "@/modules/mkt/services/auction.service";
import { AwardButton, CancelAuctionButton } from "../forms";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("auctions") };
}

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePagePermission("mkt.auctions.read");
  const t = await getTranslations();
  const locale = await getLocale();
  const data = await getOwnAuction(ctx, id).catch((e) => {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const { auction: a, bidCount, bids } = data;
  const canManage = hasPermission(ctx, "mkt.auctions.manage");
  const fmt = (v: unknown) => Number(v).toLocaleString(locale, { maximumFractionDigits: 2 });

  return (
    <>
      <PageHeader
        title={`${a.reference} · ${a.originCity ?? a.originCountry} → ${a.destinationCity ?? a.destinationCountry}`}
        description={t("mkt.auctions.detailDesc")}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs tracking-wide text-gray-500 uppercase">{t("common.status")}</p>
          <div className="mt-2">
            <Badge tone={statusTone(a.status)}>{t(`mkt.status.${a.status}`)}</Badge>
          </div>
          <p className="mt-3 text-sm">
            {t("mkt.closesAt")}: <b>{formatDateTime(a.closesAt, locale)}</b>
          </p>
          <p className="text-sm">
            {t("nav.shipments")}:{" "}
            <Link href={`/app/shipments/${a.shipment.id}`} className="font-mono hover:underline">
              {a.shipment.reference}
            </Link>{" "}
            <Badge tone={statusTone(a.shipment.status)}>{t(`status.${a.shipment.status}`)}</Badge>
          </p>
        </Card>
        <Card className="!border-navy-900 !bg-navy-900 text-white">
          <p className="text-xs tracking-wide text-white/60 uppercase">{t("mkt.sealedBids")}</p>
          <p className="font-mono text-4xl font-semibold">{bidCount}</p>
          <p className="mt-2 text-sm text-white/70">{t("mkt.blindNote")}</p>
        </Card>
        <Card>
          <p className="text-xs tracking-wide text-gray-500 uppercase">{t("mkt.cargo")}</p>
          <p className="mt-2 text-sm">{a.cargoSummary}</p>
          <p className="mt-2 text-sm text-gray-600">
            {a.totalWeightKg ? `${fmt(a.totalWeightKg)} kg · ` : ""}
            {a.modes.map((m) => t(`shp.modes.${m}`)).join(" / ")}
            {a.hazardous ? ` · ${t("mkt.hazardous")}` : ""}
          </p>
          <p className="text-sm text-gray-600">
            {formatDate(a.pickupFrom, locale)} → {formatDate(a.deliveryBy, locale)}
          </p>
        </Card>
      </div>
      {canManage && (a.status === "OPEN" || a.status === "CLOSED") && (
        <div className="mb-6">
          <CancelAuctionButton auctionId={a.id} />
        </div>
      )}
      <h2 className="text-navy-900 mb-3 font-semibold">{t("mkt.bids")}</h2>
      {bids.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-600">
            {a.status === "OPEN" ? t("mkt.bidsHiddenUntilClose") : t("mkt.noBids")}
          </p>
        </Card>
      ) : (
        <Table
          head={[
            t("mkt.providerLabel"),
            t("mkt.amount"),
            t("mkt.mode"),
            t("mkt.transitDays"),
            t("mkt.validUntil"),
            t("common.status"),
            "",
          ]}
        >
          {bids.map((b, i) => (
            <tr key={b.id} className={i === 0 ? "bg-amber-50" : undefined}>
              <Td>
                <span className="font-medium">{b.organization.name}</span>{" "}
                <span className="text-xs text-gray-500">{b.organization.country}</span>
              </Td>
              <Td className="font-mono font-semibold">
                {b.currency} {fmt(b.amount)}
              </Td>
              <Td>{t(`shp.modes.${b.mode}`)}</Td>
              <Td>{b.transitDays}</Td>
              <Td>{b.validUntil ? formatDateTime(b.validUntil, locale) : t("common.none")}</Td>
              <Td>
                <Badge tone={statusTone(b.status)}>{t(`mkt.bidStatus.${b.status}`)}</Badge>
              </Td>
              <Td>
                {canManage && a.status === "CLOSED" && b.status === "SUBMITTED" && (
                  <AwardButton auctionId={a.id} bidId={b.id} />
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
