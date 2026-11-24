import { getLocale, getTranslations } from "next-intl/server";
import { RouteMap } from "@/components/map/route-map";
import Link from "next/link";
import { ActionButton, AutoRefresh } from "@/components/odf/client";
import { Radar } from "@/components/odf/radar";
import { Badge, Card, PageHeader, statusTone } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { hasPermission } from "@/modules/iam/rbac";
import { requirePagePermission } from "@/modules/iam/session-context";
import { cancelFreightAction, confirmDeliveryAction, retryFreightAction } from "@/modules/odf/actions";
import { formatKm, formatMoney, placeLabel } from "@/modules/odf/format";
import type { PriceBreakdown } from "@/modules/odf/pricing";
import { canCancel } from "@/modules/odf/rules";
import { getOwnRequest, nearbyDrivers } from "@/modules/odf/services/freight.service";
import { RatingForm } from "./rating-form";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("freight") };
}

export default async function FreightRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePagePermission("odf.requests.read");
  const t = await getTranslations();
  const locale = await getLocale();
  const { request: r, offers, trackingEvents, position, trust } = await getOwnRequest(ctx, id);
  const manage = hasPermission(ctx, "odf.requests.manage");
  const b = r.priceBreakdown as unknown as PriceBreakdown;
  const money = (v: number) => formatMoney(v, r.currency, locale);
  const live = ["SEARCHING", "ACCEPTED", "AT_PICKUP", "IN_TRANSIT"].includes(r.status);
  const radar =
    r.status === "SEARCHING"
      ? await nearbyDrivers(ctx, { lat: Number(r.pickupLat), lng: Number(r.pickupLng) }, r.category)
      : [];
  return (
    <div className="odf">
      {live && <AutoRefresh seconds={4} />}
      <PageHeader
        title={r.reference}
        description={`${placeLabel(t, r.pickupLabel)} → ${placeLabel(t, r.dropoffLabel)} · ${t(`odf.categories.${r.category}`)}`}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Badge tone={statusTone(r.status)}>{t(`odf.status.${r.status}`)}</Badge>
        {r.shipment && (
          <Link href={`/app/shipments/${r.shipment.id}`} className="text-navy-900 font-mono text-sm underline">
            {t("odf.shipment")} {r.shipment.reference}
          </Link>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <RouteMap
            className="h-64 w-full rounded-xl"
            points={[
              { lat: Number(r.pickupLat), lng: Number(r.pickupLng), kind: "pickup", label: t("odf.pickup") },
              { lat: Number(r.dropoffLat), lng: Number(r.dropoffLng), kind: "dropoff", label: t("odf.dropoff") },
              ...(live && position?.latitude
                ? [
                    {
                      lat: Number(position.latitude),
                      lng: Number(position.longitude),
                      kind: "driver" as const,
                      label: t("odf.driver"),
                    },
                  ]
                : []),
            ]}
          />
          {r.status === "SEARCHING" && (
            <Card className="!border-[#0b1d3a] !bg-[#0b1d3a] text-white">
              <Radar drivers={radar} label={t("odf.nearby")} pulsing />
              <p className="mt-2 text-center text-sm">{t("odf.searching")}</p>
              <p className="odf-data mt-1 text-center text-xs text-slate-400">
                {t("odf.offersSent")}: {offers} · {t("odf.nearby")}: {radar.length}
              </p>
              <p className="mt-2 text-center text-[11px] text-slate-500">{t("odf.radarNote")}</p>
            </Card>
          )}
          {r.status === "NO_DRIVERS" && (
            <Card>
              <p className="mb-3 text-sm text-slate-700">{t("odf.noDriversDesc")}</p>
              {manage && (
                <div className="flex flex-wrap gap-3">
                  <ActionButton
                    action={retryFreightAction}
                    fields={{ id: r.id }}
                    label={t("odf.retry")}
                    variant="gold"
                  />
                  <Link href="/app/shipments" className="text-navy-900 self-center text-sm underline">
                    {t("odf.toAuction")}
                  </Link>
                </div>
              )}
            </Card>
          )}
          {r.driver && (
            <Card>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500 uppercase">{t("odf.provider")}</dt>
                  <dd className="font-semibold">
                    {r.provider?.name}{" "}
                    <span className="ml-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">
                      {t("odf.trustScore")} {trust?.score ?? "—"}
                    </span>
                  </dd>
                  <dd className="text-xs text-slate-500">
                    {trust?.count ? t("odf.ratings", { count: trust.count }) : t("odf.trustNone")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 uppercase">{t("odf.driver")}</dt>
                  <dd className="font-semibold">{r.driver.name}</dd>
                  <dd className="text-xs text-slate-500">{r.driver.phone ?? r.provider?.phone ?? ""}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 uppercase">{t("odf.plate")}</dt>
                  <dd className="font-mono font-semibold">{r.vehicle?.plate}</dd>
                </div>
                {position?.latitude && (
                  <div>
                    <dt className="text-xs text-slate-500 uppercase">{t("odf.lastPosition")}</dt>
                    <dd className="odf-data">
                      {Number(position.latitude).toFixed(4)}, {Number(position.longitude).toFixed(4)} ·{" "}
                      {formatDateTime(position.locatedAt, locale)}
                    </dd>
                  </div>
                )}
              </dl>
            </Card>
          )}
          {trackingEvents.length > 0 && (
            <Card>
              <h2 className="mb-3 font-bold text-[#0b1d3a]">{t("odf.timeline")}</h2>
              <ol className="space-y-2 border-l-2 border-[#d4a337] pl-4 text-sm">
                {trackingEvents.map((e) => (
                  <li key={e.id}>
                    <span className="font-semibold">
                      {t.has(`odf.events.${e.code}`) ? t(`odf.events.${e.code}`) : e.code}
                    </span>{" "}
                    <span className="text-xs text-slate-500">{formatDateTime(e.occurredAt, locale)}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
          {r.status === "DELIVERED" && manage && (
            <Card>
              {r.rating ? (
                <p className="text-sm font-semibold">{t("odf.rated", { rating: r.rating })}</p>
              ) : (
                <RatingForm id={r.id} />
              )}
            </Card>
          )}
        </div>
        <aside className="space-y-4">
          <Card className="!border-[#0b1d3a] !bg-[#0b1d3a] text-white">
            <p className="text-xs font-bold tracking-wider text-[#f2c35b] uppercase">{t("odf.price")}</p>
            <p className="odf-data text-3xl font-extrabold">{money(Number(r.price))}</p>
            <dl className="odf-data mt-3 space-y-1 text-sm text-slate-300">
              <div className="flex justify-between">
                <dt>{t("odf.distance")}</dt>
                <dd>{formatKm(r.distanceKm, locale)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t("odf.freight")}</dt>
                <dd>{money(b.freight)}</dd>
              </div>
              {b.stevedores > 0 && (
                <div className="flex justify-between">
                  <dt>
                    {t("odf.stevedores")} × {r.stevedores}
                  </dt>
                  <dd>{money(b.stevedores)}</dd>
                </div>
              )}
              {b.waybill > 0 && (
                <div className="flex justify-between">
                  <dt>{t("odf.waybill")}</dt>
                  <dd>{money(b.waybill)}</dd>
                </div>
              )}
              {b.insurance > 0 && (
                <div className="flex justify-between">
                  <dt>{t("odf.insurance")}</dt>
                  <dd>{money(b.insurance)}</dd>
                </div>
              )}
            </dl>
            <p className="mt-3 text-[11px] text-slate-400">{t("odf.paymentPending")}</p>
          </Card>
          {manage && ["ACCEPTED", "AT_PICKUP", "IN_TRANSIT"].includes(r.status) && (
            <Card className="border-2 border-[#d4a337]">
              <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">{t("odf.deliveryCode")}</p>
              <p className="font-mono text-3xl font-extrabold tracking-[0.3em]" data-testid="odf-delivery-code">
                {r.deliveryCode}
              </p>
              <p className="mt-1 text-xs text-slate-500">{t("odf.deliveryCodeHint")}</p>
            </Card>
          )}
          <Card>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500 uppercase">{t("odf.cargo")}</dt>
                <dd>{r.cargoDescription}</dd>
              </div>
              {r.weightKg && (
                <div>
                  <dt className="text-xs text-slate-500 uppercase">{t("odf.weightKg")}</dt>
                  <dd className="odf-data">{Number(r.weightKg).toLocaleString(locale)}</dd>
                </div>
              )}
              {r.containerType && (
                <div>
                  <dt className="text-xs text-slate-500 uppercase">{t("odf.containerType")}</dt>
                  <dd className="font-mono">{r.containerType}</dd>
                </div>
              )}
              {r.scheduledFor && (
                <div>
                  <dt className="text-xs text-slate-500 uppercase">{t("odf.scheduledFor")}</dt>
                  <dd>{formatDateTime(r.scheduledFor, locale)}</dd>
                </div>
              )}
            </dl>
          </Card>
          {manage && r.status === "IN_TRANSIT" && (
            <ActionButton action={confirmDeliveryAction} fields={{ id: r.id }} label={t("odf.confirmDelivery")} />
          )}
          {manage && canCancel(r.status) && (
            <ActionButton action={cancelFreightAction} fields={{ id: r.id }} label={t("odf.cancel")} variant="danger" />
          )}
        </aside>
      </div>
    </div>
  );
}
