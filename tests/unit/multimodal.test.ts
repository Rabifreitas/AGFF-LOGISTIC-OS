import { describe, expect, it } from "vitest";
import { canBeBookedAsCarrier, isCarrierType, partnerOperatesMode } from "@/modules/mkt/partner-status";
import { partnerSchema } from "@/modules/mkt/schemas";
import { itemSchema, legSchema, shipmentSchema } from "@/modules/shp/schemas";
import { shipmentTransitionBlocker } from "@/modules/shp/shipment-status";
import { planTrackingEvent } from "@/modules/trk/tracking-codes";

const ready = { stops: [{ type: "PICKUP" }, { type: "DELIVERY" }], items: [1], carrierPartnerId: "c1" };

describe("modos e tipos de transportador", () => {
  it("todos os tipos de transporte são transportadores; armazéns e estiva não", () => {
    for (const t of ["TRANSPORTER", "SHIPPING_LINE", "AIRLINE", "RAIL_OPERATOR", "BARGE_OPERATOR", "COURIER"]) {
      expect(isCarrierType(t)).toBe(true);
    }
    for (const t of ["WAREHOUSE", "STEVEDORE", "PORT_TERMINAL", "CUSTOMER", "INSURER"]) {
      expect(isCarrierType(t)).toBe(false);
    }
  });

  it("usa os modos declarados ou, sem declaração, os do tipo; transitários operam todos", () => {
    expect(partnerOperatesMode({ type: "SHIPPING_LINE", modes: [] }, "SEA")).toBe(true);
    expect(partnerOperatesMode({ type: "SHIPPING_LINE", modes: [] }, "AIR")).toBe(false);
    expect(partnerOperatesMode({ type: "TRANSPORTER", modes: ["ROAD", "RAIL"] }, "RAIL")).toBe(true);
    expect(partnerOperatesMode({ type: "TRANSPORTER", modes: ["RAIL"] }, "ROAD")).toBe(false);
    expect(partnerOperatesMode({ type: "BARGE_OPERATOR" }, "INLAND_WATERWAY")).toBe(true);
    expect(partnerOperatesMode({ type: "FREIGHT_FORWARDER", modes: [] }, "MULTIMODAL")).toBe(true);
    expect(partnerOperatesMode({ type: "AIRLINE", modes: [] }, "MULTIMODAL")).toBe(false);
  });

  it("reserva exige verificação, tipo transportador e o modo certo", () => {
    expect(canBeBookedAsCarrier({ status: "VERIFIED", type: "AIRLINE" }, "AIR")).toBe(true);
    expect(canBeBookedAsCarrier({ status: "VERIFIED", type: "AIRLINE" }, "SEA")).toBe(false);
    expect(canBeBookedAsCarrier({ status: "VERIFIED", type: "STEVEDORE" }, "SEA")).toBe(false);
    expect(canBeBookedAsCarrier({ status: "PENDING_VERIFICATION", type: "AIRLINE" }, "AIR")).toBe(false);
  });
});

describe("expedições multimodais", () => {
  it("multimodal só reserva com pelo menos dois modos diferentes nas pernas", () => {
    expect(shipmentTransitionBlocker("book", { ...ready, mode: "MULTIMODAL", legs: [] })).toBe(
      "shp.multimodalNeedsLegs",
    );
    expect(
      shipmentTransitionBlocker("book", { ...ready, mode: "MULTIMODAL", legs: [{ mode: "ROAD" }, { mode: "ROAD" }] }),
    ).toBe("shp.multimodalNeedsLegs");
    expect(
      shipmentTransitionBlocker("book", { ...ready, mode: "MULTIMODAL", legs: [{ mode: "ROAD" }, { mode: "SEA" }] }),
    ).toBeNull();
    expect(shipmentTransitionBlocker("book", { ...ready, mode: "AIR", legs: [] })).toBeNull();
    expect(shipmentTransitionBlocker("book", { ...ready, mode: "ROAD", legs: [{ mode: "SEA" }] })).toBe(
      "shp.legModeMismatch",
    );
  });

  it("perna valida modo, datas e não aceita MULTIMODAL", () => {
    const base = { mode: "SEA", origin: "Luanda", destination: "Lobito" };
    expect(legSchema.parse({ ...base, vesselName: "MSC Angola" }).vesselName).toBe("MSC Angola");
    expect(legSchema.safeParse({ ...base, mode: "MULTIMODAL" }).success).toBe(false);
    expect(
      legSchema.safeParse({ ...base, plannedDepartureAt: "2026-05-02T10:00", plannedArrivalAt: "2026-05-01T10:00" })
        .success,
    ).toBe(false);
  });

  it("serviços e modos vêm de caixas múltiplas e removem duplicados", () => {
    expect(shipmentSchema.parse({ mode: "SEA", currency: "AOA" }).services).toEqual([]);
    expect(
      shipmentSchema.parse({ mode: "SEA", currency: "AOA", services: ["STEVEDORING", "STEVEDORING", "WAREHOUSING"] })
        .services,
    ).toEqual(["STEVEDORING", "WAREHOUSING"]);
    const p = partnerSchema.parse({ type: "STEVEDORE", name: "Estiva Luanda", country: "AO", services: "STEVEDORING" });
    expect(p.services).toEqual(["STEVEDORING"]);
    expect(
      partnerSchema.safeParse({ type: "STEVEDORE", name: "X Y", country: "AO", modes: ["TELEPORT"] }).success,
    ).toBe(false);
  });

  it("carga: contentor, frio e perigosa", () => {
    const reefer = itemSchema.parse({
      description: "Peixe congelado",
      quantity: "1",
      cargoType: "REEFER",
      containerNumber: "MSCU1234567",
      tempMinC: "-20",
      tempMaxC: "-18",
    });
    expect(reefer.tempMinC).toBe(-20);
    expect(reefer.dangerousGoods).toBe(false);
    expect(itemSchema.safeParse({ description: "Frio", quantity: "1", tempMinC: "5", tempMaxC: "2" }).success).toBe(
      false,
    );
    expect(itemSchema.parse({ description: "Gasóleo", quantity: "1", unNumber: "UN1202" }).dangerousGoods).toBe(true);
    expect(itemSchema.parse({ description: "Ácido", quantity: "1", cargoType: "DANGEROUS" }).dangerousGoods).toBe(true);
  });

  it("eventos marítimos, aéreos e ferroviários iniciam o trânsito", () => {
    const can = (t: string) => t === "dispatch";
    for (const code of ["LOADED_ON_VESSEL", "VESSEL_DEPARTED", "FLIGHT_DEPARTED", "RAIL_DEPARTED"] as const) {
      expect(planTrackingEvent("BOOKED", code, can)).toEqual({ transition: "dispatch" });
    }
    expect(planTrackingEvent("IN_TRANSIT", "WAREHOUSE_IN", () => false)).toEqual({ transition: null });
  });
});
