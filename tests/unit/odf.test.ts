import { describe, expect, it } from "vitest";
import { bearingDeg, estimatedRoadKm, haversineKm } from "@/modules/odf/geo";
import { providerAmount, quoteFreight } from "@/modules/odf/pricing";
import {
  canCancel,
  nextTripStep,
  PLACES,
  rankCandidates,
  searchStartFor,
  SCHEDULE_LEAD_MS,
  trustScore,
} from "@/modules/odf/rules";
import { freightRequestSchema } from "@/modules/odf/schemas";

const tariff = {
  currency: "AOA",
  baseFee: 60000,
  perKm: 1500,
  minimumFee: 90000,
  stevedoreFee: 7500,
  waybillFee: 2500,
  insuranceRatePct: 0.35,
};

describe("geo", () => {
  it("haversine Luanda → Lobito ≈ 400 km; estrada aplica o factor 1,3", () => {
    const d = haversineKm(PLACES.LUANDA_PORT, PLACES.LOBITO_PORT);
    expect(d).toBeGreaterThan(380);
    expect(d).toBeLessThan(420);
    expect(estimatedRoadKm(PLACES.LUANDA_PORT, PLACES.LOBITO_PORT)).toBeCloseTo(d * 1.3, 0);
  });
  it("rumo: sul ≈ 180°, este ≈ 90°", () => {
    expect(bearingDeg({ lat: 0, lng: 0 }, { lat: -1, lng: 0 })).toBeCloseTo(180, 0);
    expect(bearingDeg({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90, 0);
  });
});

describe("preço tabelado", () => {
  it("aplica o mínimo em distâncias curtas e base + km nas longas", () => {
    const base = { stevedores: 0, waybill: false, insurance: false, declaredValue: null };
    expect(quoteFreight(tariff, { ...base, distanceKm: 5 }).freight).toBe(90000);
    expect(quoteFreight(tariff, { ...base, distanceKm: 100 }).freight).toBe(210000);
  });
  it("soma extras; o prestador recebe frete + estiva, não seguro nem guia", () => {
    const q = quoteFreight(tariff, {
      distanceKm: 100,
      stevedores: 2,
      waybill: true,
      insurance: true,
      declaredValue: 10_000_000,
    });
    expect(q.stevedores).toBe(15000);
    expect(q.waybill).toBe(2500);
    expect(q.insurance).toBe(35000);
    expect(q.total).toBe(210000 + 15000 + 2500 + 35000);
    expect(providerAmount(q)).toBe(225000);
  });
});

describe("regras", () => {
  const c = (id: string, lat: number, lng: number) => ({
    driverUserId: id,
    organizationId: "o",
    vehicleId: id,
    lat,
    lng,
  });
  it("ordena pelo mais próximo e exclui fora do raio", () => {
    const ranked = rankCandidates(PLACES.LUANDA_PORT, [
      c("far", -8.9, 13.4),
      c("near", -8.805, 13.245),
      c("out", -12.3, 13.5),
    ]);
    expect(ranked.map((r) => r.driverUserId)).toEqual(["near", "far"]);
  });
  it("agendados começam a procurar com antecedência", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    expect(searchStartFor(null, now)).toEqual(now);
    const later = new Date(now.getTime() + 3 * 3600_000);
    expect(searchStartFor(later, now).getTime()).toBe(later.getTime() - SCHEDULE_LEAD_MS);
  });
  it("passos da corrida, cancelamento e TrustScore", () => {
    expect(nextTripStep("ACCEPTED")).toBe("arrive");
    expect(nextTripStep("AT_PICKUP")).toBe("pickUp");
    expect(nextTripStep("IN_TRANSIT")).toBe("deliver");
    expect(nextTripStep("DELIVERED")).toBeNull();
    expect(canCancel("AT_PICKUP")).toBe(true);
    expect(canCancel("IN_TRANSIT")).toBe(false);
    expect(trustScore(null, 0)).toBeNull();
    expect(trustScore(5, 3)).toBe(100);
    expect(trustScore(3, 3)).toBe(50);
  });
});

describe("validação do pedido", () => {
  const base = { category: "CONTAINER_TRUCK", cargoDescription: "Contentor" };
  it("resolve locais conhecidos e coordenadas manuais", () => {
    const r = freightRequestSchema.parse({
      ...base,
      pickupPlace: "LUANDA_PORT",
      dropoffPlace: "CUSTOM",
      dropoffLat: "-8.9",
      dropoffLng: "13.3",
    });
    expect(r.pickup.lat).toBe(PLACES.LUANDA_PORT.lat);
    expect(r.dropoff).toMatchObject({ lat: -8.9, lng: 13.3 });
  });
  it("rejeita mesmo ponto, ponto em falta e seguro sem valor declarado", () => {
    expect(freightRequestSchema.safeParse({ ...base, pickupPlace: "VIANA", dropoffPlace: "VIANA" }).success).toBe(
      false,
    );
    expect(freightRequestSchema.safeParse({ ...base, pickupPlace: "VIANA", dropoffPlace: "" }).success).toBe(false);
    expect(
      freightRequestSchema.safeParse({ ...base, pickupPlace: "VIANA", dropoffPlace: "CACUACO", insurance: "on" })
        .success,
    ).toBe(false);
  });
});
