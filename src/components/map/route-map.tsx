"use client";

import dynamic from "next/dynamic";

export type MapPoint = { lat: number; lng: number; kind: "pickup" | "dropoff" | "driver"; label?: string };

/** Mapa OpenStreetMap (Leaflet), só no browser. */
export const RouteMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />,
});

export function directionsUrl(from: { lat: number; lng: number } | null, to: { lat: number; lng: number }) {
  const route = `${from ? `${from.lat},${from.lng}` : ""};${to.lat},${to.lng}`;
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(route)}`;
}
