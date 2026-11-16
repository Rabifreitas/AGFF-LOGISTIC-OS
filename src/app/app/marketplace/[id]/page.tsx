import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, statusTone } from "@/components/ui";
import { isAppError } from "@/lib/errors";
import { formatDate, formatDateTime, toLocalDateTimeInput } from "@/lib/utils";
import { requirePagePermission } from "@/modules/iam/session-context";
import { getMarketplaceAuction } from "@/modules/mkt/services/auction.service";
import { BidForm, WithdrawBidButton } from "../forms";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("marketplace") };
}

export default async function MarketplaceAuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePagePermission("mkt.bids.read");
  const t = await getTranslations();
  const locale = await getLocale();
  const data = await getMarketplaceAuction(ctx, id).catch((e) => {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const { auction: a, myBid, canBid, shipper } = data;
  const allowedModes = a.modes.filter((m) => data.profile?.modes.includes(m));
  const fmt = (v: unknown) => Number(v).toLocaleString(locale, { maximumFractionDigits: 2 });

  return (
    <>
      <PageHeader
        title={`${a.originCity ?? a.originCountry} → ${a.destinationCity ?? a.destinationCountry}`}
        description={`${a.reference} · ${t("mkt.anonymousShipper")}`}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Card>
          <div className="flex items-center justify-between">
            <Badge tone={statusTone(a.status)}>{t(`mkt.status.${a.status}`)}</Badge>
            <span className="font-mono text-sm">
              {t("mkt.closes")} {formatDateTime(a.closesAt, locale)}
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">{t("mkt.origin")}</dt>
              <dd className="font-medium">
                {a.originCity ?? "—"}, {a.originCountry}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">{t("mkt.destination")}</dt>
              <dd className="font-medium">
                {a.destinationCity ?? "—"}, {a.destinationCountry}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">{t("mkt.window")}</dt>
              <dd>
                {formatDate(a.pickupFrom, locale)} → {formatDate(a.deliveryBy, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">{t("mkt.acceptedModes")}</dt>
              <dd>{a.modes.map((m) => t(`shp.modes.${m}`)).join(" / ")}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-gray-500">{t("mkt.cargo")}</dt>
              <dd>
                {a.cargoSummary}
                {a.totalWeightKg ? ` · ${fmt(a.totalWeightKg)} kg` : ""}
                {a.totalVolumeM3 ? ` · ${fmt(a.totalVolumeM3)} m³` : ""}
                {a.hazardous && (
                  <>
                    {" "}
                    <Badge tone="red">{t("mkt.hazardous")}</Badge>
                  </>
                )}
              </dd>
            </div>
            {a.services.length > 0 && (
              <div className="col-span-2">
                <dt className="text-gray-500">{t("mkt.requiredServices")}</dt>
                <dd>{a.services.map((s) => t(`shp.services.${s}`)).join(", ")}</dd>
              </div>
            )}
            {a.publicNotes && (
              <div className="col-span-2">
                <dt className="text-gray-500">{t("mkt.publicNotes")}</dt>
                <dd>{a.publicNotes}</dd>
              </div>
            )}
          </dl>
        </Card>
        <Card className="border-t-4 border-t-[#C69A3B]">
          <h2 className="text-navy-900 font-semibold">{t("mkt.yourBid")}</h2>
          <p className="mb-4 text-xs text-gray-600">{t("mkt.blindBidNote")}</p>
          {myBid && (
            <div className="mb-4 rounded-md bg-gray-50 p-3 text-sm">
              <Badge tone={statusTone(myBid.status)}>{t(`mkt.bidStatus.${myBid.status}`)}</Badge>
              <p className="mt-2 font-mono text-lg font-semibold">
                {myBid.currency} {fmt(myBid.amount)}
              </p>
              <p>
                {t(`shp.modes.${myBid.mode}`)} · {myBid.transitDays} {t("mkt.days")}
              </p>
            </div>
          )}
          {shipper && (
            <div className="mb-4 rounded-md border border-green-300 bg-green-50 p-3 text-sm">
              <p className="font-semibold">{t("mkt.wonContact")}</p>
              <p>{shipper.name}</p>
              <p>{[shipper.email, shipper.phone].filter(Boolean).join(" · ")}</p>
            </div>
          )}
          {canBid && (
            <BidForm
              auctionId={a.id}
              modes={allowedModes}
              currency={a.currency}
              current={
                myBid && myBid.status === "SUBMITTED"
                  ? {
                      amount: myBid.amount.toString(),
                      mode: myBid.mode,
                      transitDays: myBid.transitDays,
                      validUntil: toLocalDateTimeInput(myBid.validUntil),
                      notes: myBid.notes,
                    }
                  : null
              }
            />
          )}
          {canBid && myBid?.status === "SUBMITTED" && <WithdrawBidButton auctionId={a.id} />}
        </Card>
      </div>
    </>
  );
}
