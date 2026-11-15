import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { ActorContext } from "@/modules/iam/rbac";
import { auctionSchema, bidSchema, providerProfileSchema } from "@/modules/mkt/auction-schemas";
import {
  awardAuction,
  cancelAuction,
  createAuction,
  getMarketplaceAuction,
  getOwnAuction,
  listMarketplace,
  listOwnBids,
  placeBid,
  reviewProviderProfile,
  saveProviderProfile,
  submitProviderProfile,
  sweepDueAuctions,
  withdrawBid,
} from "@/modules/mkt/services/auction.service";
import { getPartner } from "@/modules/mkt/services/partner.service";
import { itemSchema, shipmentSchema, stopSchema } from "@/modules/shp/schemas";
import {
  addItem,
  addStop,
  createShipment,
  getShipment,
  transitionShipment,
} from "@/modules/shp/services/shipment.service";
import { createActiveCompany, resetDatabase, superAdminContext } from "./helpers";

type Company = Awaited<ReturnType<typeof createActiveCompany>>;
let Shipper: Company;
let P1: Company;
let P2: Company;
let Unverified: Company;

const inHours = (h: number) => new Date(Date.now() + h * 3_600_000);

async function verifiedProvider(ctx: ActorContext, modes: string[], services: string[] = ["TRANSPORT"]) {
  const p = await saveProviderProfile(ctx, providerProfileSchema.parse({ modes, services, countries: "AO, CD" }));
  await submitProviderProfile(ctx);
  await reviewProviderProfile(await superAdminContext(), p.id, { decision: "verify", validUntil: null, reason: null });
}

async function requestedShipment(ctx: ActorContext) {
  const s = await createShipment(ctx, shipmentSchema.parse({ mode: "ROAD", currency: "USD" }));
  await addStop(
    ctx,
    s.id,
    stopSchema.parse({ type: "PICKUP", address: "Rua Secreta 12, Viana", city: "Luanda", country: "AO" }),
  );
  await addStop(
    ctx,
    s.id,
    stopSchema.parse({ type: "DELIVERY", address: "Av. Kasai 4", city: "Lubumbashi", country: "CD" }),
  );
  await addItem(ctx, s.id, itemSchema.parse({ description: "Cobre", quantity: "6", unit: "CNT", weightKg: "132000" }));
  await transitionShipment(ctx, s.id, "request");
  return s;
}

async function publish(ctx: ActorContext, shipmentId: string, o: Record<string, unknown> = {}) {
  return createAuction(
    ctx,
    auctionSchema.parse({
      shipmentId,
      closesAt: inHours(2).toISOString(),
      modes: ["ROAD", "RAIL"],
      services: ["TRANSPORT"],
      currency: "USD",
      ...o,
    }),
  );
}

const bid = (amount: number, mode = "ROAD") => bidSchema.parse({ amount: String(amount), mode, transitDays: "6" });
const closeNow = (id: string) =>
  prisma.auction.update({ where: { id }, data: { closesAt: new Date(Date.now() - 1000) } });

beforeEach(async () => {
  await resetDatabase();
  Shipper = await createActiveCompany();
  P1 = await createActiveCompany({ organizationType: "TRANSPORTER" });
  P2 = await createActiveCompany({ organizationType: "TRANSPORTER" });
  Unverified = await createActiveCompany({ organizationType: "TRANSPORTER" });
  await verifiedProvider(P1.ctx, ["ROAD"]);
  await verifiedProvider(P2.ctx, ["RAIL", "ROAD"]);
  await saveProviderProfile(Unverified.ctx, providerProfileSchema.parse({ modes: ["ROAD"], services: ["TRANSPORT"] }));
});

describe("Publicação e anonimização", () => {
  it("prestadores vêem só a versão anónima; não verificados e o próprio expedidor não vêem", async () => {
    const s = await requestedShipment(Shipper.ctx);
    const a = await publish(Shipper.ctx, s.id);
    expect(a.reference).toMatch(/^LEI-\d{4}-00001$/);

    const market = await listMarketplace(P1.ctx);
    expect(market.auctions.map((x) => x.id)).toEqual([a.id]);
    const json = JSON.stringify(market.auctions[0]);
    expect(json).not.toContain("Rua Secreta");
    expect(json).not.toContain(Shipper.organization.name);
    expect(json).not.toContain(Shipper.organization.id);
    expect(market.auctions[0]).toMatchObject({ originCity: "Luanda", destinationCountry: "CD" });

    expect((await listMarketplace(Unverified.ctx)).auctions).toEqual([]);
    await expect(getMarketplaceAuction(Unverified.ctx, a.id)).rejects.toThrow();
    await expect(placeBid(Unverified.ctx, a.id, bid(1000))).rejects.toThrow("mkt.bid.notEligible");
    await expect(placeBid(Shipper.ctx, a.id, bid(1000))).rejects.toThrow();
  });

  it("filtra por serviços exigidos e recusa modo não aceite", async () => {
    const s = await requestedShipment(Shipper.ctx);
    const a = await publish(Shipper.ctx, s.id, { services: ["TRANSPORT", "CUSTOMS_CLEARANCE"] });
    expect((await listMarketplace(P1.ctx)).auctions).toEqual([]);
    await expect(placeBid(P1.ctx, a.id, bid(900))).rejects.toThrow("mkt.bid.notEligible");

    const s2 = await requestedShipment(Shipper.ctx);
    const roadOnly = await publish(Shipper.ctx, s2.id, { modes: ["ROAD"] });
    await expect(placeBid(P2.ctx, roadOnly.id, bid(900, "RAIL"))).rejects.toThrow("mkt.bid.modeNotAccepted");
  });

  it("só publica expedições pedidas e não duplica leilões activos", async () => {
    const draft = await createShipment(Shipper.ctx, shipmentSchema.parse({ mode: "ROAD", currency: "USD" }));
    await expect(publish(Shipper.ctx, draft.id)).rejects.toThrow("mkt.auction.shipmentNotRequested");
    const s = await requestedShipment(Shipper.ctx);
    await publish(Shipper.ctx, s.id);
    await expect(publish(Shipper.ctx, s.id)).rejects.toThrow("mkt.auction.alreadyActive");
    await expect(publish(Shipper.ctx, s.id, { closesAt: inHours(0.1).toISOString() })).rejects.toThrow(
      "mkt.auction.closesTooSoon",
    );
    await expect(publish(P1.ctx, s.id)).rejects.toThrow();
  });
});

describe("Propostas cegas", () => {
  it("concorrentes e expedidor não vêem propostas antes do fecho", async () => {
    const s = await requestedShipment(Shipper.ctx);
    const a = await publish(Shipper.ctx, s.id);
    await placeBid(P1.ctx, a.id, bid(12000));
    await placeBid(P2.ctx, a.id, bid(9800, "RAIL"));

    const p1View = await getMarketplaceAuction(P1.ctx, a.id);
    expect(p1View.myBid?.amount.toString()).toBe("12000");
    expect(JSON.stringify(p1View)).not.toContain("9800");

    const own = await getOwnAuction(Shipper.ctx, a.id);
    expect(own.bidCount).toBe(2);
    expect(own.bids).toEqual([]);
    expect(
      await prisma.auditLog.count({ where: { organizationId: Shipper.organization.id, entityType: "AuctionBid" } }),
    ).toBe(0);

    await placeBid(P1.ctx, a.id, bid(9500));
    await withdrawBid(P2.ctx, a.id);
    await closeNow(a.id);
    const closed = await getOwnAuction(Shipper.ctx, a.id);
    expect(closed.auction.status).toBe("CLOSED");
    expect(closed.bids.map((b) => b.amount.toString())).toEqual(["9500"]);
    await expect(placeBid(P2.ctx, a.id, bid(9000))).rejects.toThrow("mkt.auction.closed");
  });

  it("leilão sem propostas expira sozinho", async () => {
    const s = await requestedShipment(Shipper.ctx);
    const a = await publish(Shipper.ctx, s.id);
    await closeNow(a.id);
    expect(await sweepDueAuctions()).toEqual({ closed: 0, expired: 1 });
    expect((await getOwnAuction(Shipper.ctx, a.id)).auction.status).toBe("EXPIRED");
  });
});

describe("Adjudicação", () => {
  it("adjudica a proposta escolhida (não a mais barata) e reserva a expedição", async () => {
    const s = await requestedShipment(Shipper.ctx);
    const a = await publish(Shipper.ctx, s.id);
    const b1 = await placeBid(P1.ctx, a.id, bid(12000));
    const b2 = await placeBid(P2.ctx, a.id, bid(9800, "RAIL"));
    await expect(awardAuction(Shipper.ctx, a.id, b1.id)).rejects.toThrow("mkt.auction.notClosed");
    await closeNow(a.id);
    await expect(awardAuction(P1.ctx, a.id, b1.id)).rejects.toThrow();

    const { partnerId } = await awardAuction(Shipper.ctx, a.id, b1.id);
    const shipment = await getShipment(Shipper.ctx, s.id);
    expect(shipment.status).toBe("BOOKED");
    expect(shipment.carrierPartnerId).toBe(partnerId);
    const partner = await getPartner(Shipper.ctx, partnerId);
    expect(partner).toMatchObject({ status: "VERIFIED", linkedOrganizationId: P1.organization.id });
    expect(partner.verifications[0]).toMatchObject({ kind: "MARKETPLACE", status: "APPROVED" });

    const winner = await getMarketplaceAuction(P1.ctx, a.id);
    expect(winner.myBid?.status).toBe("ACCEPTED");
    expect(winner.shipper?.name).toBe(Shipper.organization.name);
    const loser = await getMarketplaceAuction(P2.ctx, a.id);
    expect(loser.myBid?.status).toBe("LOST");
    expect(loser.shipper).toBeNull();
    expect((await listOwnBids(P2.ctx))[0]?.id).toBe(b2.id);
    await expect(awardAuction(Shipper.ctx, a.id, b2.id)).rejects.toThrow("mkt.auction.notClosed");
  });

  it("não adjudica a prestador suspenso entretanto e permite cancelar", async () => {
    const s = await requestedShipment(Shipper.ctx);
    const a = await publish(Shipper.ctx, s.id);
    const b1 = await placeBid(P1.ctx, a.id, bid(12000));
    await closeNow(a.id);
    const profile = await prisma.providerProfile.findUniqueOrThrow({ where: { organizationId: P1.organization.id } });
    await reviewProviderProfile(await superAdminContext(), profile.id, {
      decision: "suspend",
      validUntil: null,
      reason: null,
    });
    await expect(awardAuction(Shipper.ctx, a.id, b1.id)).rejects.toThrow("mkt.bid.providerNotVerified");
    await cancelAuction(Shipper.ctx, a.id);
    expect((await getMarketplaceAuction(P1.ctx, a.id)).myBid?.status).toBe("LOST");
    expect((await getShipment(Shipper.ctx, s.id)).status).toBe("REQUESTED");
  });
});
