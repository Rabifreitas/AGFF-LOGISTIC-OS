"use client";

import { useLocale, useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { useSecondsLeft } from "@/components/odf/client";
import type { ActionState } from "@/modules/iam/action-result";
import { advanceTripAction, reportLocationAction, respondOfferAction, setOnlineAction } from "@/modules/odf/actions";
import { formatKm, formatMoney } from "@/modules/odf/format";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

function useAction(action: Action) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, {});
  const error = state.error ? (t.has(state.error) ? t(state.error) : state.error) : null;
  return { formAction, pending, error };
}

const POSITION_FRESH_MS = 2 * 60_000;
let lastKnown: { coords: { latitude: number; longitude: number }; at: number } | null = null;

/** Última posição conhecida (do watch) ou uma leitura rápida; nunca bloqueia o motorista mais de 5 s. */
function getPosition(): Promise<{ coords: { latitude: number; longitude: number } } | null> {
  if (lastKnown && Date.now() - lastKnown.at < POSITION_FRESH_MS) return Promise.resolve(lastKnown);
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastKnown = { coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude }, at: Date.now() };
        resolve(lastKnown);
      },
      () => resolve(null),
      { maximumAge: 60_000, timeout: 5_000 },
    );
  });
}

export function OnlineToggle({ online, canGoOnline }: { online: boolean; canGoOnline: boolean }) {
  const t = useTranslations("odf.driverApp");
  const { formAction, pending, error } = useAction(setOnlineAction);
  const [gpsError, setGpsError] = useState(false);
  const submit = async (fd: FormData) => {
    if (!online) {
      const pos = await getPosition();
      if (!pos) {
        setGpsError(true);
        return;
      }
      fd.set("lat", String(pos.coords.latitude));
      fd.set("lng", String(pos.coords.longitude));
    }
    setGpsError(false);
    startTransition(() => formAction(fd));
  };
  return (
    <form action={submit}>
      <input type="hidden" name="online" value={online ? "0" : "1"} />
      <button
        type="submit"
        disabled={pending || (!online && !canGoOnline)}
        className={`w-full rounded-2xl py-5 text-lg font-extrabold tracking-wide transition disabled:opacity-50 ${
          online ? "bg-emerald-600 text-white" : "bg-[#fece57] text-[#0b192c]"
        }`}
      >
        {online ? t("goOffline") : t("goOnline")}
      </button>
      {(error || gpsError) && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error ?? t("gpsNeeded")}
        </p>
      )}
    </form>
  );
}

/** Partilha a posição enquanto online (no máximo a cada 20 s). */
export function LocationReporter() {
  const last = useRef(0);
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        lastKnown = { coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude }, at: Date.now() };
        if (Date.now() - last.current < 20_000) return;
        last.current = Date.now();
        void reportLocationAction(pos.coords.latitude, pos.coords.longitude);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  return null;
}

export type OfferView = {
  id: string;
  expiresAt: string;
  distanceToPickupKm: number;
  netAmount: number;
  currency: string;
  reference: string;
  category: string;
  pickup: string;
  dropoff: string;
  distanceKm: number;
  cargoDescription: string;
  weightKg: number | null;
  containerType: string | null;
  stevedores: number;
};

export function OfferCard({ offer }: { offer: OfferView }) {
  const t = useTranslations("odf");
  const locale = useLocale();
  const secondsLeft = useSecondsLeft(offer.expiresAt);
  const accept = useAction(respondOfferAction);
  const decline = useAction(respondOfferAction);
  const pct = Math.min(100, (secondsLeft / 30) * 100);
  return (
    <section className="overflow-hidden rounded-2xl bg-white text-[#0b192c] shadow-xl" aria-live="polite">
      <div className="h-1.5 bg-slate-200">
        <div className="h-full bg-[#c59b27] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold tracking-wider text-[#c59b27] uppercase">{t("driverApp.newOffer")}</p>
          <p className="odf-data font-mono text-sm font-bold" data-testid="odf-countdown">
            {t("driverApp.secondsLeft", { s: secondsLeft })}
          </p>
        </div>
        <p className="odf-data mt-2 text-4xl font-extrabold">{formatMoney(offer.netAmount, offer.currency, locale)}</p>
        <p className="text-xs text-slate-500">{t("driverApp.netAmount")}</p>
        <ol className="mt-4 space-y-2 border-l-2 border-dashed border-slate-300 pl-4 text-sm">
          <li>
            <span className="font-bold">{offer.pickup}</span>{" "}
            <span className="text-xs text-slate-500">
              {formatKm(offer.distanceToPickupKm, locale)} {t("driverApp.toPickup")}
            </span>
          </li>
          <li>
            <span className="font-bold">{offer.dropoff}</span>{" "}
            <span className="text-xs text-slate-500">{formatKm(offer.distanceKm, locale)}</span>
          </li>
        </ol>
        <dl className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs">
          <div className="col-span-2">
            <dt className="text-slate-500">{t("cargo")}</dt>
            <dd className="font-semibold">{offer.cargoDescription}</dd>
          </div>
          {offer.containerType && (
            <div>
              <dt className="text-slate-500">{t("containerType")}</dt>
              <dd className="font-mono font-semibold">{offer.containerType}</dd>
            </div>
          )}
          {offer.weightKg !== null && (
            <div>
              <dt className="text-slate-500">{t("weightKg")}</dt>
              <dd className="odf-data font-semibold">{offer.weightKg.toLocaleString(locale)}</dd>
            </div>
          )}
          {offer.stevedores > 0 && (
            <div>
              <dt className="text-slate-500">{t("stevedores")}</dt>
              <dd className="font-semibold">{offer.stevedores}</dd>
            </div>
          )}
          <div>
            <dt className="text-slate-500">{t("reference")}</dt>
            <dd className="font-mono font-semibold">{offer.reference}</dd>
          </div>
        </dl>
        <div className="mt-5 grid grid-cols-[1fr_2fr] gap-3">
          <form action={decline.formAction}>
            <input type="hidden" name="id" value={offer.id} />
            <input type="hidden" name="decision" value="decline" />
            <Button type="submit" variant="secondary" disabled={decline.pending} className="w-full py-4">
              {t("driverApp.decline")}
            </Button>
          </form>
          <form action={accept.formAction}>
            <input type="hidden" name="id" value={offer.id} />
            <input type="hidden" name="decision" value="accept" />
            <button
              type="submit"
              disabled={accept.pending || secondsLeft === 0}
              className="w-full rounded-md bg-emerald-600 py-4 font-extrabold text-white disabled:opacity-50"
            >
              {t("driverApp.accept")}
            </button>
          </form>
        </div>
        {(accept.error || decline.error) && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {accept.error ?? decline.error}
          </p>
        )}
      </div>
    </section>
  );
}

export function TripStepButton({ id, step }: { id: string; step: "arrive" | "pickUp" | "deliver" }) {
  const t = useTranslations("odf.driverApp");
  const { formAction, pending, error } = useAction(advanceTripAction);
  const submit = async (fd: FormData) => {
    const pos = await getPosition();
    if (pos) {
      fd.set("lat", String(pos.coords.latitude));
      fd.set("lng", String(pos.coords.longitude));
    }
    startTransition(() => formAction(fd));
  };
  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="step" value={step} />
      {step === "deliver" && (
        <label className="block text-sm">
          {t("codePrompt")}
          <input
            name="deliveryCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-3 text-center font-mono text-2xl tracking-[0.4em] text-[#0b192c]"
          />
        </label>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-[#fece57] py-5 text-lg font-extrabold text-[#0b192c] disabled:opacity-50"
      >
        {t(step)}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}
