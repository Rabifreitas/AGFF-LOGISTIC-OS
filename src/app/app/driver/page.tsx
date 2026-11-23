import { getLocale, getTranslations } from "next-intl/server";
import { AutoRefresh } from "@/components/odf/client";
import { formatDateTime } from "@/lib/utils";
import { requirePagePermission } from "@/modules/iam/session-context";
import { formatMoney, placeLabel } from "@/modules/odf/format";
import { nextTripStep } from "@/modules/odf/rules";
import { getDriverHome } from "@/modules/odf/services/freight.service";
import { LocationReporter, OfferCard, OnlineToggle, TripStepButton } from "./driver-client";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("driver") };
}

const mapsUrl = (lat: unknown, lng: unknown) =>
  `https://www.google.com/maps/dir/?api=1&destination=${Number(lat)},${Number(lng)}`;

export default async function DriverPage() {
  const ctx = await requirePagePermission("odf.driver");
  const t = await getTranslations();
  const locale = await getLocale();
  const home = await getDriverHome(ctx);
  const online = home.presence?.online ?? false;
  const step = home.trip ? nextTripStep(home.trip.status) : null;
  return (
    <div className="odf -m-4 min-h-[calc(100vh-4rem)] bg-[#0b192c] p-4 text-white sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-md space-y-5">
        {(online || home.trip) && <AutoRefresh seconds={3} />}
        {online && <LocationReporter />}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold">{t("odf.driverApp.title")}</h1>
            <p className="font-mono text-xs text-slate-400">
              {home.vehicle ? `${home.vehicle.plate} · ${t(`odf.categories.${home.vehicle.category}`)}` : ""}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${online ? "bg-emerald-600" : "bg-slate-700 text-slate-300"}`}
          >
            {online ? t("odf.fleet.online") : t("odf.fleet.offline")}
          </span>
        </header>

        {!home.vehicle && (
          <p className="rounded-lg bg-red-900/40 p-3 text-sm text-red-200">{t("odf.driverApp.noVehicle")}</p>
        )}

        {home.trip ? (
          <section className="space-y-4 rounded-2xl bg-[#13294a] p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold tracking-wider text-[#fece57] uppercase">
                {t("odf.driverApp.currentTrip")}
              </p>
              <span className="rounded-full bg-[#fece57] px-2.5 py-0.5 text-xs font-bold text-[#0b192c]">
                {t(`odf.status.${home.trip.status}`)}
              </span>
            </div>
            <p className="odf-data text-3xl font-extrabold">
              {formatMoney(home.trip.netAmount, home.trip.currency, locale)}
            </p>
            <div className="text-sm">
              <p className="text-xs text-slate-400">{t("odf.driverApp.shipper")}</p>
              <p className="font-semibold">{home.trip.organization.name}</p>
              {home.trip.organization.phone && (
                <a href={`tel:${home.trip.organization.phone}`} className="text-[#fece57] underline">
                  {home.trip.organization.phone}
                </a>
              )}
            </div>
            <ol className="space-y-3 border-l-2 border-dashed border-slate-600 pl-4 text-sm">
              {[
                ["pickup", home.trip.pickupLabel, home.trip.pickupAddress, home.trip.pickupLat, home.trip.pickupLng],
                [
                  "dropoff",
                  home.trip.dropoffLabel,
                  home.trip.dropoffAddress,
                  home.trip.dropoffLat,
                  home.trip.dropoffLng,
                ],
              ].map(([k, label, address, lat, lng]) => (
                <li key={String(k)}>
                  <p className="text-xs text-slate-400">{t(`odf.${k}`)}</p>
                  <p className="font-bold">{placeLabel(t, String(label))}</p>
                  {address && <p className="text-slate-300">{String(address)}</p>}
                  <a
                    href={mapsUrl(lat, lng)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#fece57] underline"
                  >
                    {t("odf.driverApp.navigate")}
                  </a>
                </li>
              ))}
            </ol>
            <p className="text-sm text-slate-300">
              {home.trip.cargoDescription}
              {home.trip.containerType ? ` · ${home.trip.containerType}` : ""}
              {home.trip.weightKg ? ` · ${Number(home.trip.weightKg).toLocaleString(locale)} kg` : ""}
            </p>
            {step && <TripStepButton id={home.trip.id} step={step} />}
          </section>
        ) : home.offer ? (
          <OfferCard
            offer={{
              id: home.offer.id,
              expiresAt: home.offer.expiresAt.toISOString(),
              distanceToPickupKm: Number(home.offer.distanceToPickupKm),
              netAmount: home.offer.netAmount,
              currency: home.offer.request.currency,
              reference: home.offer.request.reference,
              category: home.offer.request.category,
              pickup: placeLabel(t, home.offer.request.pickupLabel),
              dropoff: placeLabel(t, home.offer.request.dropoffLabel),
              distanceKm: Number(home.offer.request.distanceKm),
              cargoDescription: home.offer.request.cargoDescription,
              weightKg: home.offer.request.weightKg === null ? null : Number(home.offer.request.weightKg),
              containerType: home.offer.request.containerType,
              stevedores: home.offer.request.stevedores,
            }}
          />
        ) : (
          <>
            <OnlineToggle online={online} canGoOnline={!!home.vehicle} />
            {online && (
              <p className="text-center text-sm text-slate-300" aria-live="polite">
                {t("odf.driverApp.waiting")}
              </p>
            )}
          </>
        )}

        <section className="rounded-2xl bg-[#13294a] p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">{t("odf.driverApp.earnings")}</h2>
            <p className="odf-data text-xl font-extrabold text-[#fece57]">
              {formatMoney(home.earningsTotal, "AOA", locale)}
            </p>
          </div>
          <h3 className="mt-4 mb-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
            {t("odf.driverApp.history")}
          </h3>
          {home.done.length === 0 ? (
            <p className="text-sm text-slate-400">{t("odf.driverApp.noHistory")}</p>
          ) : (
            <ul className="divide-y divide-slate-700 text-sm">
              {home.done.map((d) => (
                <li key={d.id} className="flex justify-between py-2">
                  <span>
                    <span className="font-mono text-xs text-slate-400">{d.reference}</span>
                    <br />
                    {placeLabel(t, d.pickupLabel)} → {placeLabel(t, d.dropoffLabel)}
                    <br />
                    <span className="text-xs text-slate-400">{formatDateTime(d.deliveredAt, locale)}</span>
                  </span>
                  <span className="odf-data text-right font-semibold">
                    {formatMoney(d.netAmount, d.currency, locale)}
                    {d.rating ? <span className="block text-xs text-[#fece57]">{"★".repeat(d.rating)}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
