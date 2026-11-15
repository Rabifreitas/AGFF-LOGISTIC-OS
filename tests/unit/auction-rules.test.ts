import { describe, expect, it } from "vitest";
import {
  bidsVisibleToOwner,
  buildAuctionSnapshot,
  closesAtError,
  effectiveAuctionStatus,
  nextProviderStatus,
  providerEligibleFor,
} from "@/modules/mkt/auction-rules";

const now = new Date("2026-11-15T12:00:00Z");
const at = (min: number) => new Date(now.getTime() + min * 60_000);
const provider = { status: "VERIFIED" as const, modes: ["ROAD"], services: ["TRANSPORT"], validUntil: null };

describe("auction rules", () => {
  it("valida a janela de fecho", () => {
    expect(closesAtError(at(5), now)).toBe("mkt.auction.closesTooSoon");
    expect(closesAtError(at(60), now)).toBeNull();
    expect(closesAtError(at(31 * 24 * 60), now)).toBe("mkt.auction.closesTooLate");
  });

  it("fecha com propostas e expira sem propostas", () => {
    expect(effectiveAuctionStatus({ status: "OPEN", closesAt: at(-1) }, 2, now)).toBe("CLOSED");
    expect(effectiveAuctionStatus({ status: "OPEN", closesAt: at(-1) }, 0, now)).toBe("EXPIRED");
    expect(effectiveAuctionStatus({ status: "OPEN", closesAt: at(10) }, 0, now)).toBe("OPEN");
  });

  it("propostas só ficam visíveis ao expedidor depois do fecho", () => {
    expect(bidsVisibleToOwner({ status: "OPEN", closesAt: at(10) }, now)).toBe(false);
    expect(bidsVisibleToOwner({ status: "OPEN", closesAt: at(-1) }, now)).toBe(true);
    expect(bidsVisibleToOwner({ status: "CANCELLED", closesAt: at(-1) }, now)).toBe(false);
  });

  it("elegibilidade exige verificação válida, modo comum e todos os serviços", () => {
    const a = { modes: ["ROAD", "RAIL"], services: ["TRANSPORT"] };
    expect(providerEligibleFor(provider, a, now)).toBe(true);
    expect(providerEligibleFor({ ...provider, status: "PENDING" }, a, now)).toBe(false);
    expect(providerEligibleFor({ ...provider, validUntil: at(-1) }, a, now)).toBe(false);
    expect(providerEligibleFor(provider, { ...a, modes: ["AIR"] }, now)).toBe(false);
    expect(providerEligibleFor(provider, { ...a, services: ["TRANSPORT", "WAREHOUSING"] }, now)).toBe(false);
  });

  it("transições do perfil de prestador", () => {
    expect(nextProviderStatus("DRAFT", "submit")).toBe("PENDING");
    expect(nextProviderStatus("PENDING", "verify")).toBe("VERIFIED");
    expect(nextProviderStatus("DRAFT", "verify")).toBeNull();
    expect(nextProviderStatus("SUSPENDED", "reactivate")).toBe("VERIFIED");
  });

  it("snapshot anónimo não inclui moradas", () => {
    const snap = buildAuctionSnapshot({
      plannedPickupAt: null,
      plannedDeliveryAt: null,
      stops: [
        { type: "PICKUP", city: "Luanda", country: "AO" },
        { type: "DELIVERY", city: "Huambo", country: "AO" },
      ],
      items: [
        {
          description: "Cimento",
          quantity: "10",
          unit: "T",
          weightKg: "10000",
          volumeM3: null,
          dangerousGoods: false,
          cargoType: "GENERAL",
          containerType: null,
        },
      ],
    });
    expect(snap).toMatchObject({
      originCity: "Luanda",
      destinationCity: "Huambo",
      totalWeightKg: 10000,
      hazardous: false,
    });
    expect(buildAuctionSnapshot({ plannedPickupAt: null, plannedDeliveryAt: null, stops: [], items: [] })).toBeNull();
  });
});
