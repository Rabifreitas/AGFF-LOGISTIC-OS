import type { ShipmentTransition } from "@/modules/shp/shipment-status";

export const TRACKING_CODES = [
  "PICKED_UP",
  "DEPARTED",
  "ARRIVED",
  "CUSTOMS_IN",
  "CUSTOMS_CLEARED",
  "DELAYED",
  "DELIVERED",
  "NOTE",
] as const;
export type TrackingCode = (typeof TRACKING_CODES)[number];

/** Eventos que fazem avançar o estado da expedição; os restantes são informativos. */
const EVENT_TRANSITION: Partial<Record<TrackingCode, ShipmentTransition>> = {
  PICKED_UP: "dispatch",
  DEPARTED: "dispatch",
  CUSTOMS_IN: "enterCustoms",
  CUSTOMS_CLEARED: "clearCustoms",
  DELIVERED: "deliver",
};

export function transitionForEvent(code: TrackingCode): ShipmentTransition | null {
  return EVENT_TRANSITION[code] ?? null;
}

const TRACKABLE: readonly string[] = ["BOOKED", "IN_TRANSIT", "AT_CUSTOMS"];
const TARGET: Record<ShipmentTransition, string> = {
  request: "REQUESTED",
  markQuoted: "QUOTED",
  book: "BOOKED",
  dispatch: "IN_TRANSIT",
  enterCustoms: "AT_CUSTOMS",
  clearCustoms: "IN_TRANSIT",
  deliver: "DELIVERED",
  cancel: "CANCELLED",
};

/**
 * Decide o efeito de um evento numa expedição com o estado `status`:
 * erro (código i18n), sem efeito no estado, ou uma transição a aplicar.
 */
export function planTrackingEvent(
  status: string,
  code: TrackingCode,
  canTransition: (t: ShipmentTransition) => boolean,
): { error: string } | { transition: ShipmentTransition | null } {
  if (!TRACKABLE.includes(status)) return { error: "trk.notTrackable" };
  const t = transitionForEvent(code);
  if (!t) return { transition: null };
  if (canTransition(t)) return { transition: t };
  if (TARGET[t] === status) return { transition: null };
  return { error: "trk.invalidForStatus" };
}
