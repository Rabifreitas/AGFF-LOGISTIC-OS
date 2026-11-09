import { describe, expect, it } from "vitest";
import type { ShipmentStatus } from "@prisma/client";
import {
  hasValidVerification,
  availablePartnerTransitions,
  canBeBookedAsCarrier,
  nextPartnerStatus,
} from "@/modules/mkt/partner-status";
import { itemSchema, shipmentSchema, stopSchema } from "@/modules/shp/schemas";
import {
  availableShipmentTransitions,
  formatShipmentReference,
  isShipmentEditable,
  nextShipmentStatus,
  shipmentTransitionBlocker,
} from "@/modules/shp/shipment-status";
import { availableIncidentTransitions, nextIncidentStatus } from "@/modules/trk/incident-status";
import { trackingEventSchema } from "@/modules/trk/schemas";
import { planTrackingEvent } from "@/modules/trk/tracking-codes";

describe("máquina de estados da expedição", () => {
  it("segue o fluxo DRAFT → … → DELIVERED", () => {
    expect(nextShipmentStatus("DRAFT", "request")).toBe("REQUESTED");
    expect(nextShipmentStatus("REQUESTED", "markQuoted")).toBe("QUOTED");
    expect(nextShipmentStatus("QUOTED", "book")).toBe("BOOKED");
    expect(nextShipmentStatus("REQUESTED", "book")).toBe("BOOKED");
    expect(nextShipmentStatus("BOOKED", "dispatch")).toBe("IN_TRANSIT");
    expect(nextShipmentStatus("IN_TRANSIT", "enterCustoms")).toBe("AT_CUSTOMS");
    expect(nextShipmentStatus("AT_CUSTOMS", "clearCustoms")).toBe("IN_TRANSIT");
    expect(nextShipmentStatus("IN_TRANSIT", "deliver")).toBe("DELIVERED");
  });

  it("bloqueia saltos e estados finais", () => {
    expect(nextShipmentStatus("DRAFT", "dispatch")).toBeNull();
    expect(nextShipmentStatus("BOOKED", "deliver")).toBeNull();
    expect(nextShipmentStatus("AT_CUSTOMS", "deliver")).toBeNull();
    for (const s of ["DELIVERED", "CANCELLED"] as ShipmentStatus[]) expect(availableShipmentTransitions(s)).toEqual([]);
  });

  it("só cancela antes de a carga sair", () => {
    for (const s of ["DRAFT", "REQUESTED", "QUOTED", "BOOKED"] as ShipmentStatus[]) {
      expect(nextShipmentStatus(s, "cancel")).toBe("CANCELLED");
    }
    expect(nextShipmentStatus("IN_TRANSIT", "cancel")).toBeNull();
  });

  it("edição só até à reserva", () => {
    expect(isShipmentEditable("QUOTED")).toBe(true);
    expect(isShipmentEditable("BOOKED")).toBe(false);
  });

  it("exige recolha, entrega, carga e transportador", () => {
    const base = { stops: [{ type: "PICKUP" }], items: [{}], carrierPartnerId: null };
    expect(shipmentTransitionBlocker("request", base)).toBe("shp.needsStops");
    const ok = { ...base, stops: [{ type: "PICKUP" }, { type: "DELIVERY" }] };
    expect(shipmentTransitionBlocker("request", { ...ok, items: [] })).toBe("shp.needsItems");
    expect(shipmentTransitionBlocker("request", ok)).toBeNull();
    expect(shipmentTransitionBlocker("book", ok)).toBe("shp.needsCarrier");
    expect(shipmentTransitionBlocker("book", { ...ok, carrierPartnerId: "c" })).toBeNull();
    const reversed = { ...ok, stops: [{ type: "DELIVERY" }, { type: "PICKUP" }] };
    expect(shipmentTransitionBlocker("request", reversed)).toBe("shp.needsStops");
    expect(shipmentTransitionBlocker("book", { ...base, carrierPartnerId: "c" })).toBe("shp.needsStops");
    expect(shipmentTransitionBlocker("book", { ...ok, items: [], carrierPartnerId: "c" })).toBe("shp.needsItems");
  });

  it("verificação válida exige aprovação dentro do prazo", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(hasValidVerification([{ status: "APPROVED", expiresAt: null }], now)).toBe(true);
    expect(hasValidVerification([{ status: "APPROVED", expiresAt: new Date("2026-05-31T00:00:00Z") }], now)).toBe(
      false,
    );
    expect(hasValidVerification([{ status: "PENDING", expiresAt: null }], now)).toBe(false);
  });

  it("formata referências", () => {
    expect(formatShipmentReference(2026, 42)).toBe("SHP-2026-000042");
  });
});

describe("tracking → estado", () => {
  const plan = (status: ShipmentStatus, code: Parameters<typeof planTrackingEvent>[1]) =>
    planTrackingEvent(status, code, (t) => nextShipmentStatus(status, t) !== null);
  it("aplica transições válidas e ignora repetições", () => {
    expect(plan("BOOKED", "PICKED_UP")).toEqual({ transition: "dispatch" });
    expect(plan("IN_TRANSIT", "DEPARTED")).toEqual({ transition: null });
    expect(plan("IN_TRANSIT", "DELAYED")).toEqual({ transition: null });
    expect(plan("AT_CUSTOMS", "CUSTOMS_CLEARED")).toEqual({ transition: "clearCustoms" });
  });
  it("rejeita eventos incoerentes ou fora de operação", () => {
    expect(plan("BOOKED", "DELIVERED")).toEqual({ error: "trk.invalidForStatus" });
    expect(plan("AT_CUSTOMS", "DELIVERED")).toEqual({ error: "trk.invalidForStatus" });
    expect(plan("DRAFT", "NOTE")).toEqual({ error: "trk.notTrackable" });
    expect(plan("DELIVERED", "NOTE")).toEqual({ error: "trk.notTrackable" });
  });
});

describe("parceiros", () => {
  it("transições de verificação", () => {
    expect(nextPartnerStatus("DRAFT", "submit")).toBe("PENDING_VERIFICATION");
    expect(nextPartnerStatus("REJECTED", "submit")).toBe("PENDING_VERIFICATION");
    expect(nextPartnerStatus("PENDING_VERIFICATION", "verify")).toBe("VERIFIED");
    expect(nextPartnerStatus("DRAFT", "verify")).toBeNull();
    expect(availablePartnerTransitions("VERIFIED")).toEqual(["suspend"]);
    expect(availablePartnerTransitions("SUSPENDED")).toEqual(["reactivate"]);
  });
  it("só transportadores verificados são reserváveis", () => {
    expect(canBeBookedAsCarrier({ status: "VERIFIED", type: "TRANSPORTER" })).toBe(true);
    expect(canBeBookedAsCarrier({ status: "PENDING_VERIFICATION", type: "TRANSPORTER" })).toBe(false);
    expect(canBeBookedAsCarrier({ status: "VERIFIED", type: "CUSTOMER" })).toBe(false);
  });
});

describe("incidentes", () => {
  it("ciclo OPEN → INVESTIGATING → RESOLVED → CLOSED com reabertura", () => {
    expect(nextIncidentStatus("OPEN", "investigate")).toBe("INVESTIGATING");
    expect(nextIncidentStatus("OPEN", "resolve")).toBe("RESOLVED");
    expect(nextIncidentStatus("RESOLVED", "reopen")).toBe("OPEN");
    expect(nextIncidentStatus("RESOLVED", "close")).toBe("CLOSED");
    expect(availableIncidentTransitions("CLOSED")).toEqual([]);
  });
});

describe("validação", () => {
  it("normaliza e valida expedições, paragens e carga", () => {
    const s = shipmentSchema.parse({ mode: "SEA", currency: "usd", incoterm: "", declaredValue: "1500,50" });
    expect(s).toMatchObject({ currency: "USD", incoterm: null, declaredValue: 1500.5, carrierPartnerId: null });
    expect(shipmentSchema.safeParse({ mode: "SEA", currency: "USD", declaredValue: "-1" }).success).toBe(false);
    expect(stopSchema.safeParse({ type: "PICKUP", address: "", country: "AO" }).success).toBe(false);
    expect(itemSchema.safeParse({ description: "Carga", quantity: "0" }).success).toBe(false);
    expect(itemSchema.parse({ description: "Carga", quantity: "2", dangerousGoods: "on" }).dangerousGoods).toBe(true);
  });
  it("coordenadas fora de limites são rejeitadas", () => {
    expect(trackingEventSchema.safeParse({ code: "NOTE", latitude: "91" }).success).toBe(false);
    expect(trackingEventSchema.safeParse({ code: "UNKNOWN" }).success).toBe(false);
  });
});
