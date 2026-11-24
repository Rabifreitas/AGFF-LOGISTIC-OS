"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { removePushSubscriptionAction, savePushSubscriptionAction } from "@/modules/push/actions";

type State = "loading" | "unsupported" | "off" | "on" | "denied" | "error" | "disabled";

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function save(sub: PushSubscription) {
  const json = sub.toJSON();
  return savePushSubscriptionAction(
    { endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth },
    navigator.userAgent,
  );
}

/** Activa alertas push de ofertas neste dispositivo (no iPhone só depois de adicionar ao ecrã principal). */
export function PushToggle({ vapidKey }: { vapidKey: string | null }) {
  const t = useTranslations("odf.push");
  const [state, setState] = useState<State>("loading");
  const [standalone, setStandalone] = useState(true);

  useEffect(() => {
    setStandalone(window.matchMedia("(display-mode: standalone)").matches);
    if (!vapidKey) return setState("disabled");
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState("unsupported");
    if (Notification.permission === "denied") return setState("denied");
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (sub) => {
        if (!sub) return setState("off");
        // Liga a subscrição deste aparelho ao motorista com sessão iniciada (telemóvel partilhado).
        const res = await save(sub);
        setState(res.ok ? "on" : "error");
      })
      .catch(() => setState("error"));
  }, [vapidKey]);

  const enable = async () => {
    if (!vapidKey) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) });
      const res = await save(sub);
      setState(res.ok ? "on" : "error");
    } catch {
      setState("error");
    }
  };

  const disable = async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await removePushSubscriptionAction(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
  };

  const isIos = typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent);
  return (
    <div
      className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-200"
      data-testid="push-toggle"
    >
      <p className="font-semibold">{t("title")}</p>
      <p className="mt-1 text-xs text-slate-400">{t(`state.${state}`)}</p>
      {!standalone && <p className="mt-1 text-xs text-slate-400">{t(isIos ? "installIos" : "install")}</p>}
      {state === "off" && (
        <button
          type="button"
          onClick={enable}
          className="mt-2 rounded-md bg-[#d4a337] px-3 py-1.5 text-xs font-bold text-[#0b1d3a]"
        >
          {t("enable")}
        </button>
      )}
      {state === "on" && (
        <button type="button" onClick={disable} className="mt-2 rounded-md border border-slate-500 px-3 py-1.5 text-xs">
          {t("disable")}
        </button>
      )}
    </div>
  );
}
