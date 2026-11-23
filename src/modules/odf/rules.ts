import type { FreightRequestStatus, VehicleCategory } from "@prisma/client";
import { haversineKm, type LatLng } from "./geo";

export const VEHICLE_CATEGORIES = [
  "PICKUP_1_5T",
  "LIGHT_TRUCK_5T",
  "CONTAINER_TRUCK",
  "TIPPER_BULK",
  "REEFER_10T",
] as const satisfies readonly VehicleCategory[];

export const VEHICLE_STATUSES = ["ACTIVE", "MAINTENANCE", "INACTIVE"] as const;

/** Prazo do motorista para aceitar uma oferta. */
export const OFFER_TTL_MS = 30_000;
/** Sem motoristas elegíveis durante este tempo, o pedido termina em NO_DRIVERS. */
export const SEARCH_WINDOW_MS = 3 * 60_000;
/** Raio máximo entre o motorista e o ponto de recolha. */
export const MAX_PICKUP_RADIUS_KM = 50;
/** Posição mais antiga do que isto não conta (motorista sem sinal). */
export const PRESENCE_STALE_MS = 10 * 60_000;
/** Pedidos agendados começam a procurar motorista com esta antecedência. */
export const SCHEDULE_LEAD_MS = 30 * 60_000;
export const MAX_DELIVERY_CODE_ATTEMPTS = 5;

export const ACTIVE_TRIP_STATUSES = [
  "ACCEPTED",
  "AT_PICKUP",
  "IN_TRANSIT",
] as const satisfies readonly FreightRequestStatus[];
export const FINAL_STATUSES: readonly FreightRequestStatus[] = ["DELIVERED", "NO_DRIVERS", "CANCELLED"];

export const TRIP_STEPS = {
  arrive: { from: "ACCEPTED", to: "AT_PICKUP", code: "ARRIVED" },
  pickUp: { from: "AT_PICKUP", to: "IN_TRANSIT", code: "PICKED_UP" },
  deliver: { from: "IN_TRANSIT", to: "DELIVERED", code: "DELIVERED" },
} as const satisfies Record<string, { from: FreightRequestStatus; to: FreightRequestStatus; code: string }>;
export type TripStep = keyof typeof TRIP_STEPS;

export function isTripStep(v: string): v is TripStep {
  return Object.prototype.hasOwnProperty.call(TRIP_STEPS, v);
}

export function nextTripStep(status: FreightRequestStatus): TripStep | null {
  const found = (Object.keys(TRIP_STEPS) as TripStep[]).find((s) => TRIP_STEPS[s].from === status);
  return found ?? null;
}

/** O expedidor pode cancelar até a carga ser recolhida. */
export function canCancel(status: FreightRequestStatus) {
  return status === "SEARCHING" || status === "ACCEPTED" || status === "AT_PICKUP";
}

export type Candidate = LatLng & { driverUserId: string; organizationId: string; vehicleId: string };

/** Ordena candidatos pela distância à recolha e descarta os que estão fora do raio. */
export function rankCandidates<T extends Candidate>(pickup: LatLng, candidates: T[], radiusKm = MAX_PICKUP_RADIUS_KM) {
  return candidates
    .map((c) => ({ ...c, distanceKm: Math.round(haversineKm(pickup, c) * 100) / 100 }))
    .filter((c) => c.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm || a.driverUserId.localeCompare(b.driverUserId));
}

/** Quando começa a procura de motorista (agora, ou 30 min antes da hora agendada). */
export function searchStartFor(scheduledFor: Date | null, now: Date) {
  if (!scheduledFor) return now;
  const start = new Date(scheduledFor.getTime() - SCHEDULE_LEAD_MS);
  return start > now ? start : now;
}

/** TrustScore 0–100 a partir da média das avaliações (1–5); null sem avaliações. */
export function trustScore(avgRating: number | null, count: number) {
  if (!avgRating || count === 0) return null;
  return Math.round(((avgRating - 1) / 4) * 100);
}

/** Pontos de referência (coordenadas aproximadas do centro) até haver geocodificação. */
export const PLACES = {
  LUANDA_PORT: { lat: -8.8017, lng: 13.2406 },
  LUANDA_CENTER: { lat: -8.8383, lng: 13.2344 },
  VIANA: { lat: -8.9035, lng: 13.3741 },
  CACUACO: { lat: -8.7776, lng: 13.3707 },
  CAMAMA: { lat: -8.9333, lng: 13.2333 },
  BENGO_CAXITO: { lat: -8.5785, lng: 13.6643 },
  LOBITO_PORT: { lat: -12.3481, lng: 13.5459 },
  BENGUELA: { lat: -12.5763, lng: 13.4055 },
  HUAMBO: { lat: -12.7761, lng: 15.7392 },
  LUBANGO: { lat: -14.9172, lng: 13.4925 },
  NAMIBE_PORT: { lat: -15.1961, lng: 12.1522 },
  MALANJE: { lat: -9.5402, lng: 16.341 },
  SOYO: { lat: -6.1349, lng: 12.3689 },
  CABINDA: { lat: -5.55, lng: 12.2 },
} as const satisfies Record<string, LatLng>;
export type PlaceKey = keyof typeof PLACES;
export const PLACE_KEYS = Object.keys(PLACES) as PlaceKey[];
