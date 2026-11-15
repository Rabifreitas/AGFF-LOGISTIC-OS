import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import type { TransportMode } from "@prisma/client";
import { Badge, Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/utils";
import { requirePagePermission } from "@/modules/iam/session-context";
import { listMarketplace } from "@/modules/mkt/services/auction.service";
import { TRANSPORT_MODES } from "@/modules/shp/schemas";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("marketplace") };
}

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const ctx = await requirePagePermission("mkt.bids.read");
  const t = await getTranslations();
  const locale = await getLocale();
  const { mode } = await searchParams;
  const filterMode = TRANSPORT_MODES.includes(mode as TransportMode) ? (mode as TransportMode) : undefined;
  const { profile, auctions } = await listMarketplace(ctx, { mode: filterMode });
  const active = profile?.status === "VERIFIED";

  return (
    <>
      <PageHeader
        title={t("mkt.market.title")}
        description={t("mkt.market.desc")}
        actions={
          <Link href="/app/marketplace/bids" className={buttonClass("secondary")}>
            {t("mkt.myBids")}
          </Link>
        }
      />
      {!active ? (
        <EmptyState
          title={t("mkt.market.notVerified")}
          description={t("mkt.market.notVerifiedDesc")}
          action={
            <Link href="/app/organization/provider" className={buttonClass("gold")}>
              {t("mkt.provider.title")}
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <Link href="/app/marketplace" className={buttonClass(filterMode ? "secondary" : "primary")}>
              {t("common.all")}
            </Link>
            {profile.modes.map((m) => (
              <Link
                key={m}
                href={`/app/marketplace?mode=${m}`}
                className={buttonClass(filterMode === m ? "primary" : "secondary")}
              >
                {t(`shp.modes.${m}`)}
              </Link>
            ))}
          </div>
          {auctions.length === 0 ? (
            <EmptyState title={t("mkt.market.empty")} description={t("mkt.market.emptyDesc")} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {auctions.map((a) => (
                <Link key={a.id} href={`/app/marketplace/${a.id}`} className="block">
                  <Card className="hover:border-gold-500 h-full border-l-4 border-l-[#C69A3B] transition">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-gray-500">{a.reference}</span>
                      {a.myBid && <Badge tone="gold">{t(`mkt.bidStatus.${a.myBid.status}`)}</Badge>}
                    </div>
                    <p className="text-navy-900 mt-2 text-lg font-semibold">
                      {a.originCity ?? a.originCountry} → {a.destinationCity ?? a.destinationCountry}
                    </p>
                    <p className="text-sm text-gray-600">{a.modes.map((m) => t(`shp.modes.${m}`)).join(" / ")}</p>
                    <p className="mt-2 line-clamp-2 text-sm">{a.cargoSummary}</p>
                    <div className="mt-3 flex justify-between border-t border-dashed pt-2 text-xs text-gray-600">
                      <span>
                        {formatDate(a.pickupFrom, locale)} → {formatDate(a.deliveryBy, locale)}
                      </span>
                      <span className="font-mono">
                        {t("mkt.closes")} {formatDateTime(a.closesAt, locale)}
                      </span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
