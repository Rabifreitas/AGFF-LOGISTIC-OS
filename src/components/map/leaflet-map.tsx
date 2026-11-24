"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { MapPoint } from "./route-map";

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const LUANDA: [number, number] = [-8.8383, 13.2344];

function Fit({ points }: { points: MapPoint[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat},${p.lng}`).join("|");
  useEffect(() => {
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 13);
    else if (points.length > 1)
      map.fitBounds(
        points.map((p) => [p.lat, p.lng] as [number, number]),
        { padding: [32, 32] },
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function ClickHandler({ onPick }: { onPick?: (p: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: (e) => onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

export default function LeafletMap({
  points,
  onPick,
  className,
}: {
  points: MapPoint[];
  onPick?: (p: { lat: number; lng: number }) => void;
  className?: string;
}) {
  const route = points.filter((p) => p.kind !== "driver");
  return (
    <MapContainer center={LUANDA} zoom={11} scrollWheelZoom={false} className={className ?? "h-64 w-full rounded-lg"}>
      <TileLayer
        url={TILE_URL}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
      <Fit points={points} />
      <ClickHandler onPick={onPick} />
      {route.length === 2 && (
        <Polyline
          positions={route.map((p) => [p.lat, p.lng] as [number, number])}
          pathOptions={{ color: "#0B1D3A", dashArray: "6 8", weight: 3 }}
        />
      )}
      {points.map((p, i) => (
        <CircleMarker
          key={`${p.kind}-${i}`}
          center={[p.lat, p.lng]}
          radius={p.kind === "driver" ? 7 : 9}
          pathOptions={{
            color: "#0B1D3A",
            weight: 2,
            fillColor: p.kind === "pickup" ? "#D4A337" : p.kind === "dropoff" ? "#0B1D3A" : "#22c55e",
            fillOpacity: 1,
          }}
        >
          {p.label && <Tooltip direction="top">{p.label}</Tooltip>}
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
