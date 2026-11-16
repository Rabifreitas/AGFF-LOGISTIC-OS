import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { RoleKey } from "@/modules/iam/permissions";
import { loadActorContext } from "@/modules/iam/context-loader";
import type { ActorContext } from "@/modules/iam/rbac";
import { acceptInviteAsNewUser, createInvite } from "@/modules/iam/services/invite.service";
import { providerProfileSchema } from "@/modules/mkt/auction-schemas";
import {
  reviewProviderProfile,
  saveProviderProfile,
  submitProviderProfile,
} from "@/modules/mkt/services/auction.service";
import { OFFER_TTL_MS, SEARCH_WINDOW_MS } from "@/modules/odf/rules";
import { freightRequestSchema, tariffSchema, vehicleSchema } from "@/modules/odf/schemas";
import {
  advanceTrip,
  cancelRequest,
  createFreightRequest,
  dispatchRequest,
  getDriverHome,
  getOwnRequest,
  listFleetJobs,
  listOwnRequests,
  nearbyDrivers,
  rateRequest,
  respondToOffer,
  saveTariff,
  saveVehicle,
  setDriverOnline,
} from "@/modules/odf/services/freight.service";
import { getShipment } from "@/modules/shp/services/shipment.service";
import { createActiveCompany, PASSWORD, resetDatabase, superAdminContext } from "./helpers";

type Company = Awaited<ReturnType<typeof createActiveCompany>>;
let Shipper: Company;
let P1: Company;
let P2: Company;

async function memberWithRole(company: Company, roleKey: RoleKey, tag = ""): Promise<ActorContext> {
  const email = `${roleKey.toLowerCase()}${tag}@${company.organization.id}.test`;
  const { token } = await createInvite(company.ctx, { email, roleKey });
  const { user } = await acceptInviteAsNewUser(token, { name: `${roleKey}${tag}`, password: PASSWORD });
  return (await loadActorContext(user.id, company.organization.id))!;
}

async function verify(ctx: ActorContext, modes = ["ROAD"], services = ["TRANSPORT"]) {
  const p = await saveProviderProfile(ctx, providerProfileSchema.parse({ modes, services, countries: "AO" }));
  await submitProviderProfile(ctx);
  await reviewProviderProfile(await superAdminContext(), p.id, { decision: "verify", validUntil: null, reason: null });
}

/** Motorista online numa posição, com viatura da categoria indicada. */
async function onlineDriver(company: Company, tag: string, lat: number, lng: number, category = "CONTAINER_TRUCK") {
  const driver = await memberWithRole(company, "DRIVER", tag);
  await saveVehicle(
    company.ctx,
    vehicleSchema.parse({ plate: `LD-${tag}-00-AA`, category, driverUserId: driver.userId }),
  );
  await setDriverOnline(driver, true, { lat, lng });
  return driver;
}

const request = (o: Record<string, unknown> = {}) =>
  freightRequestSchema.parse({
    category: "CONTAINER_TRUCK",
    pickupPlace: "LUANDA_PORT",
    dropoffPlace: "VIANA",
    cargoDescription: "Contentor 40' HC — peças",
    weightKg: "24500",
    containerType: "40HC",
    stevedores: "2",
    waybill: "on",
    ...o,
  });

const pendingOffer = (driver: ActorContext) =>
  prisma.freightOffer.findFirst({ where: { driverUserId: driver.userId, status: "PENDING" } });

describe("frete imediato (preço tabelado, motorista mais próximo)", () => {
  beforeEach(async () => {
    await resetDatabase();
    const root = await superAdminContext();
    await saveTariff(
      root,
      tariffSchema.parse({
        category: "CONTAINER_TRUCK",
        baseFee: "60000",
        perKm: "1500",
        minimumFee: "90000",
        stevedoreFee: "7500",
        waybillFee: "2500",
        insuranceRatePct: "0.35",
        active: "on",
      }),
    );
    Shipper = await createActiveCompany();
    P1 = await createActiveCompany({ organizationType: "TRANSPORTER" });
    P2 = await createActiveCompany({ organizationType: "TRANSPORTER" });
    await verify(P1.ctx);
    await verify(P2.ctx);
  });

  it("fixa o preço da tabela e oferece ao motorista mais próximo; recusa passa ao seguinte", async () => {
    const far = await onlineDriver(P1, "far", -8.86, 13.3); // ~9 km do porto
    const near = await onlineDriver(P2, "near", -8.805, 13.245); // ~0,7 km
    const r = await createFreightRequest(Shipper.ctx, request());
    const b = r.priceBreakdown as { freight: number; stevedores: number; waybill: number; total: number };
    expect(b.freight).toBe(Math.max(90000, 60000 + 1500 * Number(r.distanceKm)));
    expect(b.stevedores).toBe(15000);
    expect(b.waybill).toBe(2500);
    expect(Number(r.price)).toBe(b.total);

    expect(await pendingOffer(near)).not.toBeNull();
    expect(await pendingOffer(far)).toBeNull();
    // O motorista não vê moradas nem o expedidor antes de aceitar.
    const home = await getDriverHome(near);
    expect(home.offer?.request).not.toHaveProperty("pickupAddress");
    expect(home.offer?.request).not.toHaveProperty("organizationId");
    expect(home.offer?.netAmount).toBe(b.freight + b.stevedores);

    await respondToOffer(near, home.offer!.id, false);
    expect(await pendingOffer(far)).not.toBeNull();
  });

  it("oferta sem resposta expira e passa ao seguinte; sem motoristas termina em NO_DRIVERS", async () => {
    const a = await onlineDriver(P1, "a", -8.805, 13.245);
    const r = await createFreightRequest(Shipper.ctx, request());
    const offer = await pendingOffer(a);
    expect(offer).not.toBeNull();
    const later = new Date(Date.now() + OFFER_TTL_MS + 1000);
    await dispatchRequest(r.id, later);
    expect((await prisma.freightOffer.findUnique({ where: { id: offer!.id } }))?.status).toBe("EXPIRED");
    await expect(respondToOffer(a, offer!.id, true)).rejects.toThrow();
    await dispatchRequest(r.id, new Date(Date.now() + SEARCH_WINDOW_MS + 5000));
    expect((await prisma.freightRequest.findUnique({ where: { id: r.id } }))?.status).toBe("NO_DRIVERS");
  });

  it("ignora motoristas offline, da categoria errada, da própria empresa ou de prestador não verificado", async () => {
    const P3 = await createActiveCompany({ organizationType: "TRANSPORTER" }); // não verificado
    const unverified = await onlineDriver(P3, "u", -8.802, 13.241);
    const wrongCat = await onlineDriver(P1, "w", -8.802, 13.241, "PICKUP_1_5T");
    const own = await memberWithRole(Shipper, "DRIVER", "own");
    await saveVehicle(
      Shipper.ctx,
      vehicleSchema.parse({ plate: "OWN-1", category: "CONTAINER_TRUCK", driverUserId: own.userId }),
    );
    await setDriverOnline(own, true, { lat: -8.802, lng: 13.241 });
    const offline = await onlineDriver(P2, "off", -8.802, 13.241);
    await setDriverOnline(offline, false);

    expect(await nearbyDrivers(Shipper.ctx, { lat: -8.8017, lng: 13.2406 }, "CONTAINER_TRUCK")).toHaveLength(0);
    await createFreightRequest(Shipper.ctx, request());
    for (const d of [unverified, wrongCat, own, offline]) expect(await pendingOffer(d)).toBeNull();
  });

  it("aceitar cria a expedição BOOKED com o prestador verificado; entrega exige o código", async () => {
    const d = await onlineDriver(P1, "d", -8.805, 13.245);
    const r = await createFreightRequest(Shipper.ctx, request());
    const offer = (await getDriverHome(d)).offer!;
    await respondToOffer(d, offer.id, true);

    const { request: after } = await getOwnRequest(Shipper.ctx, r.id);
    expect(after.status).toBe("ACCEPTED");
    const shipment = await getShipment(Shipper.ctx, after.shipmentId!);
    expect(shipment.status).toBe("BOOKED");
    expect(shipment.carrierPartner?.linkedOrganizationId).toBe(P1.organization.id);
    expect(shipment.stops.map((s) => s.type)).toEqual(["PICKUP", "DELIVERY"]);

    // Já com corrida activa, o motorista não recebe outra oferta.
    const r2 = await createFreightRequest(Shipper.ctx, request());
    expect(await prisma.freightOffer.count({ where: { requestId: r2.id } })).toBe(0);

    const trip = (await getDriverHome(d)).trip!;
    expect(trip.organization.name).toBe(Shipper.organization.name);
    await advanceTrip(d, r.id, "arrive");
    await expect(advanceTrip(d, r.id, "deliver", { deliveryCode: after.deliveryCode })).rejects.toThrow();
    await advanceTrip(d, r.id, "pickUp", { location: { lat: -8.85, lng: 13.3 } });
    expect((await getShipment(Shipper.ctx, shipment.id)).status).toBe("IN_TRANSIT");
    await expect(advanceTrip(d, r.id, "deliver", { deliveryCode: "000000x" })).rejects.toThrow();
    await advanceTrip(d, r.id, "deliver", { deliveryCode: after.deliveryCode });

    const done = await getOwnRequest(Shipper.ctx, r.id);
    expect(done.request.status).toBe("DELIVERED");
    expect(done.trackingEvents.map((e) => e.code)).toEqual(["ARRIVED", "PICKED_UP", "DELIVERED"]);
    expect((await getShipment(Shipper.ctx, shipment.id)).status).toBe("DELIVERED");

    await rateRequest(Shipper.ctx, r.id, { rating: 5, comment: null });
    await expect(rateRequest(Shipper.ctx, r.id, { rating: 1, comment: null })).rejects.toThrow();
    expect((await getOwnRequest(Shipper.ctx, r.id)).trust?.score).toBe(100);
    const jobs = await listFleetJobs(P1.ctx);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).not.toHaveProperty("deliveryCode");
  });

  it("isola empresas e papéis", async () => {
    const d = await onlineDriver(P1, "iso", -8.805, 13.245);
    const other = await onlineDriver(P2, "iso2", -8.9, 13.4);
    const r = await createFreightRequest(Shipper.ctx, request());
    const offer = await pendingOffer(d);
    await expect(respondToOffer(other, offer!.id, true)).rejects.toThrow();
    await expect(advanceTrip(other, r.id, "arrive")).rejects.toThrow();
    await expect(getOwnRequest(P2.ctx, r.id)).rejects.toThrow();
    expect(await listOwnRequests(P2.ctx)).toHaveLength(0);
    await expect(createFreightRequest(d, request())).rejects.toThrow();
    await expect(saveVehicle(d, vehicleSchema.parse({ plate: "X-1", category: "PICKUP_1_5T" }))).rejects.toThrow();
    // Só membros com papel Driver podem conduzir.
    await expect(
      saveVehicle(P1.ctx, vehicleSchema.parse({ plate: "X-2", category: "PICKUP_1_5T", driverUserId: other.userId })),
    ).rejects.toThrow();
  });

  it("cancelar depois de aceite cancela a expedição e liberta o motorista", async () => {
    const d = await onlineDriver(P1, "c", -8.805, 13.245);
    const r = await createFreightRequest(Shipper.ctx, request());
    await respondToOffer(d, (await pendingOffer(d))!.id, true);
    await cancelRequest(Shipper.ctx, r.id);
    const { request: after } = await getOwnRequest(Shipper.ctx, r.id);
    expect(after.status).toBe("CANCELLED");
    expect((await getShipment(Shipper.ctx, after.shipmentId!)).status).toBe("CANCELLED");
    const r2 = await createFreightRequest(Shipper.ctx, request());
    expect(await prisma.freightOffer.count({ where: { requestId: r2.id, driverUserId: d.userId } })).toBe(1);
  });

  it("duas aceitações simultâneas do mesmo motorista só ganham uma corrida", async () => {
    const d = await onlineDriver(P1, "race", -8.805, 13.245);
    const r = await createFreightRequest(Shipper.ctx, request());
    const offer = (await pendingOffer(d))!;
    const results = await Promise.allSettled([respondToOffer(d, offer.id, true), respondToOffer(d, offer.id, true)]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.shipment.count({ where: { organizationId: Shipper.organization.id } })).toBe(1);
    expect((await prisma.freightRequest.findUnique({ where: { id: r.id } }))?.status).toBe("ACCEPTED");
  });
});
