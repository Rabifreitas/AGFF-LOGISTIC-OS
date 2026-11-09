import type { ShipmentStatus } from "@prisma/client";

export type ShipmentTransition =
  "request" | "markQuoted" | "book" | "dispatch" | "enterCustoms" | "clearCustoms" | "deliver" | "cancel";

const TRANSITIONS: Record<ShipmentTransition, { from: readonly ShipmentStatus[]; to: ShipmentStatus }> = {
  request: { from: ["DRAFT"], to: "REQUESTED" },
  markQuoted: { from: ["REQUESTED"], to: "QUOTED" },
  book: { from: ["REQUESTED", "QUOTED"], to: "BOOKED" },
  dispatch: { from: ["BOOKED"], to: "IN_TRANSIT" },
  enterCustoms: { from: ["IN_TRANSIT"], to: "AT_CUSTOMS" },
  clearCustoms: { from: ["AT_CUSTOMS"], to: "IN_TRANSIT" },
  deliver: { from: ["IN_TRANSIT"], to: "DELIVERED" },
  cancel: { from: ["DRAFT", "REQUESTED", "QUOTED", "BOOKED"], to: "CANCELLED" },
};

export const SHIPMENT_TRANSITIONS = Object.keys(TRANSITIONS) as ShipmentTransition[];
export const FINAL_SHIPMENT_STATUSES: readonly ShipmentStatus[] = ["DELIVERED", "CANCELLED"];
/** Estados em que rota, carga e dados comerciais ainda podem ser editados. */
export const EDITABLE_SHIPMENT_STATUSES: readonly ShipmentStatus[] = ["DRAFT", "REQUESTED", "QUOTED"];
export const ACTIVE_SHIPMENT_STATUSES: readonly ShipmentStatus[] = [
  "REQUESTED",
  "QUOTED",
  "BOOKED",
  "IN_TRANSIT",
  "AT_CUSTOMS",
];

export function isShipmentTransition(v: string): v is ShipmentTransition {
  return v in TRANSITIONS;
}

export function canTransitionShipment(from: ShipmentStatus, t: ShipmentTransition) {
  return TRANSITIONS[t].from.includes(from);
}

/** Estado seguinte, ou null se a transição não for permitida a partir de `from`. */
export function nextShipmentStatus(from: ShipmentStatus, t: ShipmentTransition): ShipmentStatus | null {
  return canTransitionShipment(from, t) ? TRANSITIONS[t].to : null;
}

export function availableShipmentTransitions(from: ShipmentStatus): ShipmentTransition[] {
  return SHIPMENT_TRANSITIONS.filter((t) => canTransitionShipment(from, t));
}

export function isShipmentEditable(status: ShipmentStatus) {
  return EDITABLE_SHIPMENT_STATUSES.includes(status);
}

/** Pré-requisitos de negócio para uma transição (além do estado de origem). */
export function shipmentTransitionBlocker(
  t: ShipmentTransition,
  s: { stops: { type: string }[]; items: unknown[]; carrierPartnerId: string | null },
): string | null {
  // `stops` em ordem de sequência; a rota é revalidada em cada passo porque pode ser editada até QUOTED.
  if (t === "request" || t === "markQuoted" || t === "book") {
    if (s.stops[0]?.type !== "PICKUP" || s.stops.at(-1)?.type !== "DELIVERY") return "shp.needsStops";
    if (s.items.length === 0) return "shp.needsItems";
  }
  if (t === "book" && !s.carrierPartnerId) return "shp.needsCarrier";
  return null;
}

/** Referência legível e sequencial por organização: SHP-2026-000001. */
export function formatShipmentReference(year: number, seq: number) {
  return `SHP-${year}-${String(seq).padStart(6, "0")}`;
}
