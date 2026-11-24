"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect, useMemo, useState } from "react";
import { RouteMap, type MapPoint } from "@/components/map/route-map";
import { Button } from "@/components/ui";
import type { ActionState } from "@/modules/iam/action-result";
import { createFreightRequestAction } from "@/modules/odf/actions";
import { formatKm, formatMoney } from "@/modules/odf/format";
import { estimatedRoadKm } from "@/modules/odf/geo";
import { quoteFreight, type TariffValues } from "@/modules/odf/pricing";
import { PLACE_KEYS, PLACES, VEHICLE_CATEGORIES, type PlaceKey } from "@/modules/odf/rules";

const CONTAINERS = ["20DV", "40DV", "40HC", "20RF", "40RF", "20OT", "40FR"];
const input =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#d4a337] focus:outline-none";

type Point = { place: string; lat: string; lng: string; address: string };
type Hit = { label: string; lat: number; lng: number };

function resolve(p: Point) {
  if (PLACE_KEYS.includes(p.place as PlaceKey)) return PLACES[p.place as PlaceKey];
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  return p.lat && p.lng && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function PointPicker({
  prefix,
  label,
  value,
  onChange,
  allowGps,
  error,
}: {
  prefix: "pickup" | "dropoff";
  label: string;
  value: Point;
  onChange: (p: Point) => void;
  allowGps: boolean;
  error?: string;
}) {
  const t = useTranslations("odf");
  const locale = useLocale();
  const [gps, setGps] = useState<"idle" | "locating" | "denied">("idle");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [search, setSearch] = useState<"idle" | "loading" | "empty" | "off">("idle");
  const runSearch = async () => {
    if (query.trim().length < 3) return;
    setSearch("loading");
    try {
      const res = await fetch(`/api/geo/search?q=${encodeURIComponent(query)}&locale=${locale}`);
      const body = (await res.json()) as { results: Hit[] | null };
      if (body.results === null) return setSearch("off");
      setHits(body.results);
      setSearch(body.results.length ? "idle" : "empty");
    } catch {
      setSearch("empty");
    }
  };
  const pick = (h: Hit) => {
    setHits(null);
    onChange({ place: "CUSTOM", lat: h.lat.toFixed(6), lng: h.lng.toFixed(6), address: h.label });
  };
  const choose = (place: string) => {
    onChange({ ...value, place });
    if (place === "GPS" && navigator.geolocation) {
      setGps("locating");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGps("idle");
          onChange({ ...value, place, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) });
        },
        () => setGps("denied"),
        { enableHighAccuracy: true, timeout: 10_000 },
      );
    }
  };
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-bold tracking-wider text-slate-500 uppercase">{label}</legend>
      <div className="flex gap-2">
        <input
          aria-label={`${label} — ${t("searchAddress")}`}
          placeholder={t("searchAddress")}
          className={input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void runSearch();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={runSearch} disabled={search === "loading"}>
          {t("search")}
        </Button>
      </div>
      {hits && hits.length > 0 && (
        <ul className="max-h-48 overflow-auto rounded-md border border-slate-200 bg-white text-sm shadow-sm">
          {hits.map((h) => (
            <li key={`${h.lat},${h.lng}`}>
              <button type="button" className="w-full px-3 py-2 text-left hover:bg-slate-50" onClick={() => pick(h)}>
                {h.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {search === "empty" && <p className="text-xs text-slate-500">{t("searchEmpty")}</p>}
      {search === "off" && <p className="text-xs text-slate-500">{t("searchOff")}</p>}
      <select
        name={`${prefix}Place`}
        aria-label={`${label} — ${t("place")}`}
        className={input}
        value={value.place}
        onChange={(e) => choose(e.target.value)}
      >
        <option value="">—</option>
        {PLACE_KEYS.map((k) => (
          <option key={k} value={k}>
            {t(`places.${k}`)}
          </option>
        ))}
        {allowGps && <option value="GPS">{t("places.GPS")}</option>}
        <option value="CUSTOM">{t("places.CUSTOM")}</option>
      </select>
      {(value.place === "CUSTOM" || value.place === "GPS") && (
        <div className="grid grid-cols-2 gap-2">
          <input
            name={`${prefix}Lat`}
            aria-label={t("lat")}
            placeholder={t("lat")}
            className={input}
            value={value.lat}
            readOnly={value.place === "GPS"}
            onChange={(e) => onChange({ ...value, lat: e.target.value })}
          />
          <input
            name={`${prefix}Lng`}
            aria-label={t("lng")}
            placeholder={t("lng")}
            className={input}
            value={value.lng}
            readOnly={value.place === "GPS"}
            onChange={(e) => onChange({ ...value, lng: e.target.value })}
          />
        </div>
      )}
      {gps === "locating" && <p className="text-xs text-slate-500">{t("gpsLocating")}</p>}
      {gps === "denied" && <p className="text-xs text-red-700">{t("gpsDenied")}</p>}
      <input
        name={`${prefix}Address`}
        aria-label={t("address")}
        placeholder={t("address")}
        className={input}
        value={value.address}
        onChange={(e) => onChange({ ...value, address: e.target.value })}
      />
      {error && <p className="text-xs text-red-700">{error}</p>}
    </fieldset>
  );
}

export function FreightRequestForm({ tariffs }: { tariffs: Partial<Record<string, TariffValues>> }) {
  const t = useTranslations();
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createFreightRequestAction, {});
  const [pickup, setPickup] = useState<Point>({ place: "LUANDA_PORT", lat: "", lng: "", address: "" });
  const [dropoff, setDropoff] = useState<Point>({ place: "VIANA", lat: "", lng: "", address: "" });
  const [category, setCategory] = useState<string>("CONTAINER_TRUCK");
  const [stevedores, setStevedores] = useState(0);
  const [waybill, setWaybill] = useState(true);
  const [insurance, setInsurance] = useState(false);
  const [declared, setDeclared] = useState("");
  const [mapTarget, setMapTarget] = useState<"pickup" | "dropoff">("dropoff");
  const a = resolve(pickup);
  const b = resolve(dropoff);
  const routeKey = a && b ? `${a.lat},${a.lng};${b.lat},${b.lng}` : "";
  const [road, setRoad] = useState<{ key: string; km: number; source: "route" | "estimate" } | null>(null);
  useEffect(() => {
    if (!routeKey) return;
    const [from, to] = routeKey.split(";");
    const ctrl = new AbortController();
    fetch(`/api/geo/route?from=${from}&to=${to}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { km: number; source: "route" | "estimate" } | null) => d && setRoad({ key: routeKey, ...d }))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [routeKey]);
  const distance =
    a && b ? (road?.key === routeKey ? road : { km: estimatedRoadKm(a, b), source: "estimate" as const }) : null;
  const mapPoints: MapPoint[] = [
    ...(a ? [{ ...a, kind: "pickup" as const, label: t("odf.pickup") }] : []),
    ...(b ? [{ ...b, kind: "dropoff" as const, label: t("odf.dropoff") }] : []),
  ];
  const pickOnMap = (p: { lat: number; lng: number }) => {
    const next = { place: "CUSTOM", lat: p.lat.toFixed(6), lng: p.lng.toFixed(6) };
    if (mapTarget === "pickup") setPickup((v) => ({ ...v, ...next }));
    else setDropoff((v) => ({ ...v, ...next }));
  };
  const msg = (k?: string) => (k ? (t.has(k) ? t(k) : k) : undefined);
  const fe = state.fieldErrors ?? {};

  const quote = useMemo(() => {
    const tariff = tariffs[category];
    if (!distance || !tariff) return null;
    return quoteFreight(tariff, {
      distanceKm: distance.km,
      stevedores,
      waybill,
      insurance,
      declaredValue: declared ? Number(declared.replace(/\s/g, "").replace(",", ".")) : null,
    });
  }, [distance?.km, category, stevedores, waybill, insurance, declared, tariffs]); // eslint-disable-line react-hooks/exhaustive-deps

  const money = (v: number) => formatMoney(v, "AOA", locale);
  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {state.error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {msg(state.error)}
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <PointPicker
            prefix="pickup"
            label={t("odf.pickup")}
            value={pickup}
            onChange={setPickup}
            allowGps
            error={msg(fe.pickupPlace?.[0])}
          />
          <PointPicker
            prefix="dropoff"
            label={t("odf.dropoff")}
            value={dropoff}
            onChange={setDropoff}
            allowGps={false}
            error={msg(fe.dropoffPlace?.[0])}
          />
        </div>
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span>{t("odf.mapPick")}</span>
            {(["pickup", "dropoff"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={mapTarget === k}
                onClick={() => setMapTarget(k)}
                className={`rounded-full border px-3 py-1 font-semibold ${
                  mapTarget === k ? "border-[#0b1d3a] bg-[#0b1d3a] text-white" : "border-slate-300 bg-white"
                }`}
              >
                {t(`odf.${k}`)}
              </button>
            ))}
          </div>
          <RouteMap points={mapPoints} onPick={pickOnMap} />
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">{t("odf.vehicle")}</legend>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {VEHICLE_CATEGORIES.map((c) => {
              const tariff = tariffs[c];
              const selected = category === c;
              return (
                <label
                  key={c}
                  className={`cursor-pointer rounded-lg border-2 p-3 text-sm transition ${
                    selected
                      ? "border-[#d4a337] bg-[#0b1d3a] text-white"
                      : "border-slate-200 bg-white hover:border-slate-400"
                  } ${tariff ? "" : "opacity-50"}`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={c}
                    checked={selected}
                    disabled={!tariff}
                    onChange={() => setCategory(c)}
                    className="sr-only"
                  />
                  <span className="block font-bold">{t(`odf.categories.${c}`)}</span>
                  <span className={`block text-xs ${selected ? "text-slate-300" : "text-slate-500"}`}>
                    {t(`odf.categoryHints.${c}`)}
                  </span>
                  <span className="odf-data mt-1 block text-xs font-semibold">
                    {tariff ? `≥ ${money(tariff.minimumFee)}` : t("odf.noTariff")}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="grid gap-3 md:grid-cols-3">
          <legend className="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">{t("odf.cargo")}</legend>
          <label className="text-sm md:col-span-3">
            {t("odf.cargoDescription")}
            <input name="cargoDescription" required className={input} />
            {fe.cargoDescription && <span className="text-xs text-red-700">{msg(fe.cargoDescription[0])}</span>}
          </label>
          <label className="text-sm">
            {t("odf.weightKg")}
            <input name="weightKg" inputMode="decimal" className={input} />
          </label>
          <label className="text-sm">
            {t("odf.containerType")}
            <select name="containerType" className={input} defaultValue="">
              <option value="">{t("odf.noContainer")}</option>
              {CONTAINERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {t("odf.scheduledFor")}
            <input name="scheduledFor" type="datetime-local" className={input} />
          </label>
        </fieldset>

        <fieldset className="grid gap-3 md:grid-cols-3">
          <legend className="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">{t("odf.extras")}</legend>
          <label className="text-sm">
            {t("odf.stevedores")}
            <input
              name="stevedores"
              type="number"
              min={0}
              max={20}
              value={stevedores}
              onChange={(e) => setStevedores(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
              className={input}
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="waybill" checked={waybill} onChange={(e) => setWaybill(e.target.checked)} />
            {t("odf.waybill")}
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              name="insurance"
              checked={insurance}
              onChange={(e) => setInsurance(e.target.checked)}
            />
            {t("odf.insurance")}
          </label>
          {insurance && (
            <label className="text-sm md:col-span-3">
              {t("odf.declaredValue")}
              <input
                name="declaredValue"
                inputMode="decimal"
                value={declared}
                onChange={(e) => setDeclared(e.target.value)}
                className={input}
              />
              {fe.declaredValue && <span className="text-xs text-red-700">{msg(fe.declaredValue[0])}</span>}
            </label>
          )}
        </fieldset>
      </div>

      <aside className="h-fit rounded-xl bg-[#0b1d3a] p-5 text-white lg:sticky lg:top-4">
        <p className="text-xs font-bold tracking-wider text-[#f2c35b] uppercase">{t("odf.price")}</p>
        <p className="odf-data mt-1 text-3xl font-extrabold" data-testid="odf-total">
          {quote ? money(quote.total) : "—"}
        </p>
        {quote && (
          <dl className="odf-data mt-4 space-y-1 text-sm text-slate-300">
            <div className="flex justify-between">
              <dt>{t("odf.distance")}</dt>
              <dd>{formatKm(quote.distanceKm, locale)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{t("odf.freight")}</dt>
              <dd>{money(quote.freight)}</dd>
            </div>
            {quote.stevedores > 0 && (
              <div className="flex justify-between">
                <dt>{t("odf.stevedores")}</dt>
                <dd>{money(quote.stevedores)}</dd>
              </div>
            )}
            {quote.waybill > 0 && (
              <div className="flex justify-between">
                <dt>{t("odf.waybill")}</dt>
                <dd>{money(quote.waybill)}</dd>
              </div>
            )}
            {quote.insurance > 0 && (
              <div className="flex justify-between">
                <dt>{t("odf.insurance")}</dt>
                <dd>{money(quote.insurance)}</dd>
              </div>
            )}
          </dl>
        )}
        <p className="mt-3 text-[11px] leading-snug text-slate-400">
          {t(distance?.source === "route" ? "odf.priceRouted" : "odf.priceEstimated")}
        </p>
        <p className="mt-2 text-[11px] leading-snug text-slate-400">
          <strong className="text-slate-200">{t("odf.payment")}:</strong> {t("odf.paymentPending")}
        </p>
        <Button type="submit" variant="gold" disabled={pending || !quote} className="mt-4 w-full">
          {t("odf.request")}
        </Button>
      </aside>
    </form>
  );
}
