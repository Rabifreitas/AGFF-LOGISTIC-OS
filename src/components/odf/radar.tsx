import { MAX_PICKUP_RADIUS_KM } from "@/modules/odf/rules";

/** Radar esquemático: motoristas por rumo e distância à recolha (sem mapa real). */
export function Radar({
  drivers,
  label,
  radiusKm = Math.min(MAX_PICKUP_RADIUS_KM, 25),
  pulsing = false,
}: {
  drivers: { bearing: number; distanceKm: number }[];
  label: string;
  radiusKm?: number;
  pulsing?: boolean;
}) {
  const R = 120;
  return (
    <svg viewBox="-130 -130 260 260" role="img" aria-label={label} className="mx-auto h-64 w-64">
      <defs>
        <radialGradient id="odf-radar-bg">
          <stop offset="0%" stopColor="#13294a" />
          <stop offset="100%" stopColor="#0b1d3a" />
        </radialGradient>
      </defs>
      <circle r={R} fill="url(#odf-radar-bg)" />
      {[0.33, 0.66, 1].map((f) => (
        <circle key={f} r={R * f} fill="none" stroke="#d4a337" strokeOpacity={0.25} strokeDasharray="3 4" />
      ))}
      <line x1={-R} y1={0} x2={R} y2={0} stroke="#d4a337" strokeOpacity={0.15} />
      <line x1={0} y1={-R} x2={0} y2={R} stroke="#d4a337" strokeOpacity={0.15} />
      {pulsing && (
        <circle
          r={R}
          fill="none"
          stroke="#f2c35b"
          strokeWidth={2}
          className="odf-pulse"
          style={{ transformOrigin: "center" }}
        />
      )}
      {drivers.map((d, i) => {
        const r = Math.min(1, d.distanceKm / radiusKm) * (R - 8);
        const a = ((d.bearing - 90) * Math.PI) / 180;
        return (
          <g key={i} transform={`translate(${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)})`}>
            <circle r={6} fill="#059669" stroke="#ecfdf5" strokeWidth={1.5} />
          </g>
        );
      })}
      <circle r={7} fill="#f2c35b" stroke="#0b1d3a" strokeWidth={2} />
      <text y={R - 6} textAnchor="middle" fontSize={9} fill="#cbd5e1">
        {radiusKm} km
      </text>
    </svg>
  );
}
