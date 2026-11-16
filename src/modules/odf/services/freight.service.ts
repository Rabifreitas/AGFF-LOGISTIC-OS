import { randomInt } from "node:crypto";
import type { FreightRequestStatus, Prisma, VehicleCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ForbiddenError, InvalidStateError, NotFoundError } from "@/lib/errors";
import { recordAudit } from "@/modules/audit/audit.service";
import { assertPermission, hasPermission, type ActorContext } from "@/modules/iam/rbac";
import { isProviderActive } from "@/modules/mkt/auction-rules";
import { ensureMarketplacePartner } from "@/modules/mkt/services/marketplace-partner";
import { applyShipmentTransition, nextReference } from "@/modules/shp/services/shipment.service";
import { tenantDb } from "@/modules/tenancy/tenant-db";
import { bearingDeg, estimatedRoadKm } from "../geo";
import { providerAmount, quoteFreight, toTariffValues, type PriceBreakdown } from "../pricing";
import {
  ACTIVE_TRIP_STATUSES,
  canCancel,
  MAX_DELIVERY_CODE_ATTEMPTS,
  MAX_PICKUP_RADIUS_KM,
  OFFER_TTL_MS,
  PRESENCE_STALE_MS,
  rankCandidates,
  SEARCH_WINDOW_MS,
  searchStartFor,
  TRIP_STEPS,
  trustScore,
  type Candidate,
  type TripStep,
} from "../rules";
import type { FreightRequestInput, LocationInput, RatingInput, TariffInput, VehicleInput } from "../schemas";

/**
 * Frete imediato: preço tabelado pela plataforma, oferta ao motorista elegível mais próximo
 * (um de cada vez, com prazo), e execução pela app do motorista. O pedido pertence ao expedidor;
 * o motorista e o prestador só acedem por ligação explícita (oferta ou corrida atribuída) e só vêem
 * moradas e contactos depois de aceitar.
 */

type Tx = Parameters<Parameters<ReturnType<typeof tenantDb>["$transaction"]>[0]>[0];
type BaseTx = Prisma.TransactionClient;

const ACTIVE = ACTIVE_TRIP_STATUSES as unknown as FreightRequestStatus[];

// ---------------------------------------------------------------- Tarifas (plataforma)

export async function listTariffs() {
  return prisma.freightTariff.findMany({ orderBy: { category: "asc" } });
}

export async function saveTariff(ctx: ActorContext, input: TariffInput) {
  assertPermission(ctx, "platform.freight_tariffs.manage");
  const before = await prisma.freightTariff.findUnique({ where: { category: input.category } });
  const data = { ...input, currency: "AOA", updatedById: ctx.userId };
  const tariff = await prisma.freightTariff.upsert({ where: { category: input.category }, create: data, update: data });
  await recordAudit(prisma, ctx, {
    action: "freight.tariff.saved",
    entityType: "FreightTariff",
    entityId: tariff.id,
    before,
    after: tariff,
  });
  return tariff;
}

async function activeTariff(category: VehicleCategory) {
  const t = await prisma.freightTariff.findUnique({ where: { category } });
  if (!t || !t.active) throw new InvalidStateError("odf.errors.noTariff");
  return toTariffValues(t);
}

export function priceFor(tariff: ReturnType<typeof toTariffValues>, input: FreightRequestInput) {
  return quoteFreight(tariff, {
    distanceKm: estimatedRoadKm(input.pickup, input.dropoff),
    stevedores: input.stevedores,
    waybill: input.waybill,
    insurance: input.insurance,
    declaredValue: input.declaredValue,
  });
}

// ---------------------------------------------------------------- Pedido (expedidor)

async function nextFreightReference(tx: Tx, organizationId: string, now: Date) {
  const year = now.getUTCFullYear();
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`freight-ref:${organizationId}:${year}`}))`;
  const last = await tx.freightRequest.findFirst({
    where: { reference: { startsWith: `FRT-${year}-` } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const seq = last ? Number(last.reference.split("-")[2]) + 1 : 1;
  return `FRT-${year}-${String(seq).padStart(5, "0")}`;
}

export async function createFreightRequest(ctx: ActorContext, input: FreightRequestInput, now = new Date()) {
  assertPermission(ctx, "odf.requests.manage");
  if (input.scheduledFor && input.scheduledFor.getTime() < now.getTime() - 60_000) {
    throw new InvalidStateError("odf.errors.scheduledInPast");
  }
  const tariff = await activeTariff(input.category);
  const price = priceFor(tariff, input);
  const request = await tenantDb(ctx.organizationId).$transaction(async (tx) => {
    const reference = await nextFreightReference(tx, ctx.organizationId, now);
    const created = await tx.freightRequest.create({
      data: {
        organizationId: ctx.organizationId,
        reference,
        category: input.category,
        pickupLabel: input.pickup.label,
        pickupAddress: input.pickup.address,
        pickupLat: input.pickup.lat,
        pickupLng: input.pickup.lng,
        dropoffLabel: input.dropoff.label,
        dropoffAddress: input.dropoff.address,
        dropoffLat: input.dropoff.lat,
        dropoffLng: input.dropoff.lng,
        distanceKm: price.distanceKm,
        cargoDescription: input.cargoDescription,
        weightKg: input.weightKg,
        containerType: input.containerType,
        stevedores: input.stevedores,
        waybill: input.waybill,
        insurance: input.insurance,
        declaredValue: input.declaredValue,
        currency: price.currency,
        price: price.total,
        priceBreakdown: price,
        scheduledFor: input.scheduledFor,
        searchStartedAt: searchStartFor(input.scheduledFor, now),
        deliveryCode: String(randomInt(0, 1_000_000)).padStart(6, "0"),
        createdById: ctx.userId,
      },
    });
    await recordAudit(tx, ctx, {
      action: "freight.requested",
      entityType: "FreightRequest",
      entityId: created.id,
      after: { ...created, deliveryCode: undefined },
    });
    return created;
  });
  await dispatchRequest(request.id, now);
  return request;
}

export async function listOwnRequests(ctx: ActorContext) {
  assertPermission(ctx, "odf.requests.read");
  await sweepFreight();
  return tenantDb(ctx.organizationId).freightRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { vehicle: { select: { plate: true } }, provider: { select: { name: true } } },
  });
}

export async function providerTrustScores(organizationIds: string[]) {
  if (organizationIds.length === 0) return new Map<string, { score: number | null; count: number }>();
  const rows = await prisma.freightRequest.groupBy({
    by: ["providerOrganizationId"],
    where: { providerOrganizationId: { in: organizationIds }, rating: { not: null } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const out = new Map<string, { score: number | null; count: number }>();
  for (const id of organizationIds) out.set(id, { score: null, count: 0 });
  for (const r of rows) {
    if (!r.providerOrganizationId) continue;
    out.set(r.providerOrganizationId, {
      score: trustScore(r._avg.rating, r._count.rating),
      count: r._count.rating,
    });
  }
  return out;
}

export async function getOwnRequest(ctx: ActorContext, id: string) {
  assertPermission(ctx, "odf.requests.read");
  await sweepFreight();
  const request = await tenantDb(ctx.organizationId).freightRequest.findUnique({
    where: { id },
    include: {
      vehicle: { select: { plate: true, category: true, description: true } },
      provider: { select: { id: true, name: true, phone: true } },
      driver: { select: { name: true, phone: true } },
      shipment: { select: { id: true, reference: true, status: true } },
    },
  });
  if (!request) throw new NotFoundError();
  const [offers, trackingEvents, position, trust] = await Promise.all([
    prisma.freightOffer.count({ where: { requestId: id } }),
    request.shipmentId
      ? tenantDb(ctx.organizationId).trackingEvent.findMany({
          where: { shipmentId: request.shipmentId },
          orderBy: { occurredAt: "asc" },
        })
      : Promise.resolve([]),
    request.driverUserId && ACTIVE.includes(request.status)
      ? prisma.driverPresence.findUnique({
          where: { userId: request.driverUserId },
          select: { latitude: true, longitude: true, locatedAt: true },
        })
      : Promise.resolve(null),
    request.providerOrganizationId
      ? providerTrustScores([request.providerOrganizationId]).then((m) => m.get(request.providerOrganizationId!))
      : Promise.resolve(undefined),
  ]);
  return { request, offers, trackingEvents, position, trust: trust ?? null };
}

/** Motoristas disponíveis perto de um ponto, anónimos (rumo e distância), para o radar do expedidor. */
export async function nearbyDrivers(
  ctx: ActorContext,
  point: { lat: number; lng: number },
  category?: VehicleCategory,
  now = new Date(),
) {
  assertPermission(ctx, "odf.requests.read");
  const rows = await eligibleCandidates(prisma, { excludeOrganizationId: ctx.organizationId, category, now });
  return rankCandidates(point, rows).map((c) => ({
    category: c.category,
    distanceKm: c.distanceKm,
    bearing: Math.round(bearingDeg(point, c)),
  }));
}

async function loadOwnForUpdate(tx: Tx, id: string) {
  const found = await tx.freightRequest.findUnique({ where: { id }, select: { id: true } });
  if (!found) throw new NotFoundError();
  await tx.$executeRaw`SELECT 1 FROM "freight_requests" WHERE "id" = ${id} FOR UPDATE`;
  const request = await tx.freightRequest.findUnique({ where: { id } });
  if (!request) throw new NotFoundError();
  return request;
}

export async function cancelRequest(ctx: ActorContext, id: string) {
  assertPermission(ctx, "odf.requests.manage");
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    const request = await loadOwnForUpdate(tx, id);
    if (!canCancel(request.status)) throw new InvalidStateError("odf.errors.cannotCancel");
    await tx.freightOffer.updateMany({
      where: { requestId: id, status: "PENDING" },
      data: { status: "EXPIRED", respondedAt: new Date() },
    });
    await tx.freightRequest.update({ where: { id }, data: { status: "CANCELLED" } });
    if (request.shipmentId) await applyShipmentTransition(tx, ctx, request.shipmentId, "cancel");
    await recordAudit(tx, ctx, {
      action: "freight.cancelled",
      entityType: "FreightRequest",
      entityId: id,
      before: { status: request.status },
      after: { status: "CANCELLED" },
    });
  });
}

export async function retryRequest(ctx: ActorContext, id: string, now = new Date()) {
  assertPermission(ctx, "odf.requests.manage");
  await tenantDb(ctx.organizationId).$transaction(async (tx) => {
    const request = await loadOwnForUpdate(tx, id);
    if (request.status !== "NO_DRIVERS") throw new InvalidStateError("odf.errors.cannotRetry");
    await tx.freightRequest.update({ where: { id }, data: { status: "SEARCHING", searchStartedAt: now } });
    await recordAudit(tx, ctx, { action: "freight.retried", entityType: "FreightRequest", entityId: id });
  });
  await dispatchRequest(id, now);
}

/** O expedidor confirma a recepção (alternativa ao código de entrega introduzido pelo motorista). */
export async function confirmDelivery(ctx: ActorContext, id: string) {
  assertPermission(ctx, "odf.requests.manage");
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    const request = await loadOwnForUpdate(tx, id);
    if (request.status !== "IN_TRANSIT") throw new InvalidStateError("odf.errors.invalidStep");
    await completeStep(tx, ctx, request, "deliver", null, "SHIPPER");
  });
}

export async function rateRequest(ctx: ActorContext, id: string, input: RatingInput) {
  assertPermission(ctx, "odf.requests.manage");
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    const request = await loadOwnForUpdate(tx, id);
    if (request.status !== "DELIVERED") throw new InvalidStateError("odf.errors.rateAfterDelivery");
    if (request.rating !== null) throw new InvalidStateError("odf.errors.alreadyRated");
    await tx.freightRequest.update({ where: { id }, data: { rating: input.rating, ratingComment: input.comment } });
    await recordAudit(tx, ctx, {
      action: "freight.rated",
      entityType: "FreightRequest",
      entityId: id,
      after: input,
    });
  });
}

// ---------------------------------------------------------------- Dispatch

type CandidateRow = Candidate & { category: VehicleCategory };

/**
 * Motoristas online, com posição recente, viatura activa atribuída, membros activos de um prestador
 * verificado (modo ROAD + serviço TRANSPORT), sem corrida activa e sem outra oferta pendente.
 */
async function eligibleCandidates(
  db: BaseTx | typeof prisma,
  opts: { excludeOrganizationId: string; category?: VehicleCategory; requestId?: string; now: Date },
) {
  const stale = new Date(opts.now.getTime() - PRESENCE_STALE_MS);
  const rows = await db.$queryRaw<
    {
      driverUserId: string;
      organizationId: string;
      vehicleId: string;
      category: VehicleCategory;
      lat: number;
      lng: number;
    }[]
  >`
    SELECT p."user_id" AS "driverUserId", v."organization_id" AS "organizationId", v."id" AS "vehicleId",
           v."category"::text AS "category", p."latitude"::float8 AS "lat", p."longitude"::float8 AS "lng"
    FROM "driver_presence" p
    JOIN "vehicles" v ON v."driver_user_id" = p."user_id" AND v."organization_id" = p."organization_id"
      AND v."status" = 'ACTIVE'::"VehicleStatus"
    JOIN "organizations" o ON o."id" = v."organization_id" AND o."status" = 'ACTIVE'::"OrganizationStatus"
    JOIN "provider_profiles" pp ON pp."organization_id" = o."id" AND pp."status" = 'VERIFIED'::"ProviderStatus"
      AND 'ROAD'::"TransportMode" = ANY(pp."modes") AND 'TRANSPORT'::"LogisticsService" = ANY(pp."services")
      AND (pp."valid_until" IS NULL OR pp."valid_until" > ${opts.now})
    JOIN "memberships" m ON m."user_id" = p."user_id" AND m."organization_id" = o."id" AND m."status" = 'ACTIVE'::"MembershipStatus"
    JOIN "users" u ON u."id" = p."user_id" AND u."status" = 'ACTIVE'::"UserStatus"
    WHERE p."online" AND p."latitude" IS NOT NULL AND p."located_at" > ${stale}
      AND o."id" <> ${opts.excludeOrganizationId}
      AND (${opts.category ?? null}::text IS NULL OR v."category"::text = ${opts.category ?? null}::text)
      AND NOT EXISTS (
        SELECT 1 FROM "freight_offers" fo WHERE fo."driver_user_id" = p."user_id"
          AND (fo."request_id" = ${opts.requestId ?? ""} OR (fo."status" = 'PENDING'::"FreightOfferStatus" AND fo."expires_at" > ${opts.now})))
      AND NOT EXISTS (
        SELECT 1 FROM "freight_requests" fr WHERE fr."driver_user_id" = p."user_id"
          AND fr."status" IN ('ACCEPTED', 'AT_PICKUP', 'IN_TRANSIT'))`;
  return rows as CandidateRow[];
}

async function lockDriver(tx: { $executeRaw: BaseTx["$executeRaw"] }, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`odf-driver:${userId}`}))`;
}

async function driverBusy(tx: BaseTx, userId: string, now: Date) {
  const [pending, active] = await Promise.all([
    tx.freightOffer.count({ where: { driverUserId: userId, status: "PENDING", expiresAt: { gt: now } } }),
    tx.freightRequest.count({ where: { driverUserId: userId, status: { in: ACTIVE } } }),
  ]);
  return pending > 0 || active > 0;
}

/**
 * Avança o dispatch de um pedido (idempotente): expira a oferta vencida e oferece ao motorista
 * elegível mais próximo ainda não contactado; sem candidatos após SEARCH_WINDOW_MS → NO_DRIVERS.
 */
export async function dispatchRequest(requestId: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "freight_requests" WHERE "id" = ${requestId} FOR UPDATE SKIP LOCKED`;
    if (!locked) return "busy" as const;
    const request = await tx.freightRequest.findUnique({ where: { id: requestId } });
    if (!request || request.status !== "SEARCHING" || request.searchStartedAt > now) return "idle" as const;
    await tx.freightOffer.updateMany({
      where: { requestId, status: "PENDING", expiresAt: { lte: now } },
      data: { status: "EXPIRED" },
    });
    const pending = await tx.freightOffer.count({ where: { requestId, status: "PENDING" } });
    if (pending > 0) return "waiting" as const;

    const pickup = { lat: Number(request.pickupLat), lng: Number(request.pickupLng) };
    const ranked = rankCandidates(
      pickup,
      await eligibleCandidates(tx, {
        excludeOrganizationId: request.organizationId,
        category: request.category,
        requestId,
        now,
      }),
    );
    for (const c of ranked) {
      await lockDriver(tx, c.driverUserId);
      if (await driverBusy(tx, c.driverUserId, now)) continue;
      await tx.freightOffer.create({
        data: {
          requestId,
          organizationId: c.organizationId,
          driverUserId: c.driverUserId,
          vehicleId: c.vehicleId,
          distanceToPickupKm: c.distanceKm,
          expiresAt: new Date(now.getTime() + OFFER_TTL_MS),
        },
      });
      return "offered" as const;
    }
    if (now.getTime() - request.searchStartedAt.getTime() >= SEARCH_WINDOW_MS) {
      await tx.freightRequest.update({ where: { id: requestId }, data: { status: "NO_DRIVERS" } });
      return "noDrivers" as const;
    }
    return "searching" as const;
  });
}

/** Corre o dispatch de todos os pedidos em procura. Chamado nas leituras e pelo cron. */
export async function sweepFreight(now = new Date()) {
  const due = await prisma.freightRequest.findMany({
    where: { status: "SEARCHING", searchStartedAt: { lte: now } },
    select: { id: true },
    orderBy: { searchStartedAt: "asc" },
    take: 100,
  });
  const results: Record<string, number> = {};
  for (const r of due) {
    const res = await dispatchRequest(r.id, now);
    results[res] = (results[res] ?? 0) + 1;
  }
  return results;
}

// ---------------------------------------------------------------- App do motorista

async function assignedVehicle(ctx: ActorContext) {
  return tenantDb(ctx.organizationId).vehicle.findFirst({
    where: { driverUserId: ctx.userId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
  });
}

const OFFER_REQUEST_SELECT = {
  reference: true,
  category: true,
  pickupLabel: true,
  dropoffLabel: true,
  distanceKm: true,
  cargoDescription: true,
  weightKg: true,
  containerType: true,
  stevedores: true,
  currency: true,
  priceBreakdown: true,
  scheduledFor: true,
} satisfies Prisma.FreightRequestSelect;

export async function getDriverHome(ctx: ActorContext, now = new Date()) {
  assertPermission(ctx, "odf.driver");
  await sweepFreight(now);
  const [vehicle, presence, offer, trip, done] = await Promise.all([
    assignedVehicle(ctx),
    prisma.driverPresence.findUnique({ where: { userId: ctx.userId } }),
    prisma.freightOffer.findFirst({
      where: {
        driverUserId: ctx.userId,
        organizationId: ctx.organizationId,
        status: "PENDING",
        expiresAt: { gt: now },
      },
      include: { request: { select: OFFER_REQUEST_SELECT }, vehicle: { select: { plate: true } } },
    }),
    prisma.freightRequest.findFirst({
      where: { driverUserId: ctx.userId, providerOrganizationId: ctx.organizationId, status: { in: ACTIVE } },
      select: {
        ...OFFER_REQUEST_SELECT,
        id: true,
        status: true,
        pickupAddress: true,
        pickupLat: true,
        pickupLng: true,
        dropoffAddress: true,
        dropoffLat: true,
        dropoffLng: true,
        acceptedAt: true,
        organization: { select: { name: true, phone: true } },
        vehicle: { select: { plate: true } },
      },
    }),
    prisma.freightRequest.findMany({
      where: { driverUserId: ctx.userId, providerOrganizationId: ctx.organizationId, status: "DELIVERED" },
      select: {
        id: true,
        reference: true,
        pickupLabel: true,
        dropoffLabel: true,
        deliveredAt: true,
        priceBreakdown: true,
        currency: true,
        rating: true,
      },
      orderBy: { deliveredAt: "desc" },
      take: 20,
    }),
  ]);
  const earn = (b: Prisma.JsonValue) => providerAmount(b as unknown as PriceBreakdown);
  return {
    vehicle,
    presence,
    offer: offer ? { ...offer, netAmount: earn(offer.request.priceBreakdown) } : null,
    trip: trip ? { ...trip, netAmount: earn(trip.priceBreakdown) } : null,
    done: done.map((d) => ({ ...d, netAmount: earn(d.priceBreakdown) })),
    earningsTotal: done.reduce((s, d) => s + earn(d.priceBreakdown), 0),
  };
}

export async function setDriverOnline(ctx: ActorContext, online: boolean, location?: LocationInput | null) {
  assertPermission(ctx, "odf.driver");
  if (online && !(await assignedVehicle(ctx))) throw new InvalidStateError("odf.errors.noVehicle");
  const now = new Date();
  const position = location ? { latitude: location.lat, longitude: location.lng, locatedAt: now } : {};
  await prisma.$transaction(async (tx) => {
    await lockDriver(tx, ctx.userId);
    await tx.driverPresence.upsert({
      where: { userId: ctx.userId },
      create: { userId: ctx.userId, organizationId: ctx.organizationId, online, ...position },
      update: { organizationId: ctx.organizationId, online, ...position },
    });
    if (!online) {
      await tx.freightOffer.updateMany({
        where: { driverUserId: ctx.userId, status: "PENDING" },
        data: { status: "DECLINED", respondedAt: now },
      });
    }
  });
  if (!online) await sweepFreight(now);
}

export async function reportLocation(ctx: ActorContext, location: LocationInput) {
  assertPermission(ctx, "odf.driver");
  const { count } = await prisma.driverPresence.updateMany({
    where: { userId: ctx.userId, organizationId: ctx.organizationId },
    data: { latitude: location.lat, longitude: location.lng, locatedAt: new Date() },
  });
  if (count === 0) throw new InvalidStateError("odf.errors.offline");
}

export async function respondToOffer(ctx: ActorContext, offerId: string, accept: boolean, now = new Date()) {
  assertPermission(ctx, "odf.driver");
  const offer = await prisma.freightOffer.findUnique({
    where: { id: offerId },
    select: {
      id: true,
      driverUserId: true,
      organizationId: true,
      request: { select: { id: true, organizationId: true } },
    },
  });
  if (!offer || offer.driverUserId !== ctx.userId || offer.organizationId !== ctx.organizationId) {
    throw new NotFoundError();
  }
  if (!accept) {
    const { count } = await prisma.freightOffer.updateMany({
      where: { id: offerId, status: "PENDING" },
      data: { status: "DECLINED", respondedAt: now },
    });
    if (count !== 1) throw new InvalidStateError("odf.errors.offerNotPending");
    await dispatchRequest(offer.request.id, now);
    return null;
  }
  return acceptOffer(ctx, offerId, offer.request.organizationId, now);
}

/** Aceitação: cria a expedição (BOOKED) no tenant do expedidor com o prestador como parceiro MARKETPLACE. */
async function acceptOffer(ctx: ActorContext, offerId: string, shipperOrganizationId: string, now: Date) {
  const shipperCtx: ActorContext = { ...ctx, organizationId: shipperOrganizationId };
  return tenantDb(shipperOrganizationId).$transaction(async (tx) => {
    await lockDriver(tx, ctx.userId);
    const [offerRow] = await tx.$queryRaw<{ request_id: string }[]>`
      SELECT "request_id" FROM "freight_offers" WHERE "id" = ${offerId} FOR UPDATE`;
    if (!offerRow) throw new NotFoundError();
    const request = await loadOwnForUpdate(tx, offerRow.request_id);
    const offer = await tx.freightOffer.findUnique({ where: { id: offerId } });
    if (!offer || offer.status !== "PENDING") throw new InvalidStateError("odf.errors.offerNotPending");
    if (offer.expiresAt <= now) throw new InvalidStateError("odf.errors.offerExpired");
    if (request.status !== "SEARCHING") throw new InvalidStateError("odf.errors.offerNotPending");
    const active = await tx.freightRequest.count({ where: { driverUserId: ctx.userId, status: { in: ACTIVE } } });
    const activeElsewhere = await prisma.freightRequest.count({
      where: { driverUserId: ctx.userId, status: { in: ACTIVE } },
    });
    if (active + activeElsewhere > 0) throw new InvalidStateError("odf.errors.driverBusy");

    const [vehicle, provider] = await Promise.all([
      prisma.vehicle.findUnique({ where: { id: offer.vehicleId } }),
      prisma.organization.findUnique({
        where: { id: ctx.organizationId },
        select: {
          id: true,
          name: true,
          nif: true,
          country: true,
          email: true,
          phone: true,
          type: true,
          status: true,
          providerProfile: true,
        },
      }),
    ]);
    if (!vehicle || vehicle.status !== "ACTIVE" || vehicle.driverUserId !== ctx.userId) {
      throw new InvalidStateError("odf.errors.noVehicle");
    }
    const profile = provider?.providerProfile;
    if (!provider || provider.status !== "ACTIVE" || !profile || !isProviderActive(profile, now)) {
      throw new InvalidStateError("mkt.bid.providerNotVerified");
    }

    const partner = await ensureMarketplacePartner(tx, {
      shipperOrganizationId,
      provider,
      profile,
      reviewedById: ctx.userId,
      note: request.reference,
      now,
    });
    const services: ("TRANSPORT" | "STEVEDORING" | "CARGO_INSURANCE")[] = ["TRANSPORT"];
    if (request.stevedores > 0) services.push("STEVEDORING");
    if (request.insurance) services.push("CARGO_INSURANCE");
    const shipment = await tx.shipment.create({
      data: {
        organizationId: shipperOrganizationId,
        reference: await nextReference(tx, shipperOrganizationId, now),
        mode: "ROAD",
        currency: request.currency,
        declaredValue: request.declaredValue,
        services,
        carrierPartnerId: partner.id,
        plannedPickupAt: request.scheduledFor ?? now,
        notes: `${request.reference} · ${vehicle.plate}`,
        createdById: request.createdById,
      },
    });
    const stop = (
      sequence: number,
      type: "PICKUP" | "DELIVERY",
      label: string,
      address: string | null,
      lat: unknown,
      lng: unknown,
    ) =>
      tx.shipmentStop.create({
        data: {
          organizationId: shipperOrganizationId,
          shipmentId: shipment.id,
          sequence,
          type,
          name: label,
          address: address ?? label,
          latitude: lat as Prisma.Decimal,
          longitude: lng as Prisma.Decimal,
        },
      });
    await stop(1, "PICKUP", request.pickupLabel, request.pickupAddress, request.pickupLat, request.pickupLng);
    await stop(2, "DELIVERY", request.dropoffLabel, request.dropoffAddress, request.dropoffLat, request.dropoffLng);
    await tx.shipmentItem.create({
      data: {
        organizationId: shipperOrganizationId,
        shipmentId: shipment.id,
        description: request.cargoDescription,
        quantity: 1,
        weightKg: request.weightKg,
        containerType: request.containerType,
        cargoType: request.containerType ? "CONTAINER" : "GENERAL",
      },
    });
    await tx.quotation.create({
      data: {
        organizationId: shipperOrganizationId,
        shipmentId: shipment.id,
        partnerId: partner.id,
        reference: request.reference,
        status: "ACCEPTED",
        currency: request.currency,
        amount: request.price,
        notes: `${request.reference} · ${request.category} · ${request.distanceKm} km`,
      },
    });
    await applyShipmentTransition(tx, shipperCtx, shipment.id, "request");
    await applyShipmentTransition(tx, shipperCtx, shipment.id, "markQuoted");
    await applyShipmentTransition(tx, shipperCtx, shipment.id, "book");

    await tx.freightOffer.update({ where: { id: offerId }, data: { status: "ACCEPTED", respondedAt: now } });
    const { count } = await tx.freightRequest.updateMany({
      where: { id: request.id, status: "SEARCHING" },
      data: {
        status: "ACCEPTED",
        providerOrganizationId: ctx.organizationId,
        driverUserId: ctx.userId,
        vehicleId: vehicle.id,
        shipmentId: shipment.id,
        acceptedAt: now,
      },
    });
    if (count !== 1) throw new InvalidStateError("shp.concurrentChange");
    await recordAudit(tx, shipperCtx, {
      action: "freight.accepted",
      entityType: "FreightRequest",
      entityId: request.id,
      after: { driverUserId: ctx.userId, providerOrganizationId: ctx.organizationId, shipmentId: shipment.id },
    });
    return { requestId: request.id, shipmentId: shipment.id };
  });
}

async function completeStep(
  tx: Tx,
  actor: ActorContext,
  request: { id: string; status: FreightRequestStatus; shipmentId: string | null; organizationId: string },
  step: TripStep,
  location: LocationInput | null,
  source: "DRIVER_APP" | "SHIPPER",
) {
  const def = TRIP_STEPS[step];
  if (request.status !== def.from || !request.shipmentId) throw new InvalidStateError("odf.errors.invalidStep");
  const now = new Date();
  await tx.trackingEvent.create({
    data: {
      organizationId: request.organizationId,
      shipmentId: request.shipmentId,
      code: def.code,
      occurredAt: now,
      source,
      reportedById: actor.userId,
      latitude: location?.lat ?? null,
      longitude: location?.lng ?? null,
    },
  });
  if (step === "pickUp") await applyShipmentTransition(tx, actor, request.shipmentId, "dispatch");
  if (step === "deliver") await applyShipmentTransition(tx, actor, request.shipmentId, "deliver");
  const { count } = await tx.freightRequest.updateMany({
    where: { id: request.id, status: def.from },
    data: { status: def.to, ...(step === "deliver" ? { deliveredAt: now } : {}) },
  });
  if (count !== 1) throw new InvalidStateError("shp.concurrentChange");
  await recordAudit(tx, actor, {
    action: `freight.${step}`,
    entityType: "FreightRequest",
    entityId: request.id,
    before: { status: def.from },
    after: { status: def.to, source },
  });
}

/** Passos da corrida pelo motorista atribuído; a entrega exige o código dado pelo expedidor. */
export async function advanceTrip(
  ctx: ActorContext,
  requestId: string,
  step: TripStep,
  opts: { deliveryCode?: string | null; location?: LocationInput | null } = {},
) {
  assertPermission(ctx, "odf.driver");
  const ref = await prisma.freightRequest.findUnique({
    where: { id: requestId },
    select: { organizationId: true, driverUserId: true, providerOrganizationId: true },
  });
  if (!ref || ref.driverUserId !== ctx.userId || ref.providerOrganizationId !== ctx.organizationId) {
    throw new NotFoundError();
  }
  const actor: ActorContext = { ...ctx, organizationId: ref.organizationId };
  const outcome = await tenantDb(ref.organizationId).$transaction(async (tx) => {
    const request = await loadOwnForUpdate(tx, requestId);
    if (request.driverUserId !== ctx.userId) throw new ForbiddenError();
    if (step === "deliver") {
      if (request.status !== "IN_TRANSIT") throw new InvalidStateError("odf.errors.invalidStep");
      if (request.deliveryCodeAttempts >= MAX_DELIVERY_CODE_ATTEMPTS)
        throw new InvalidStateError("odf.errors.codeLocked");
      if ((opts.deliveryCode ?? "").trim() !== request.deliveryCode) {
        await tx.freightRequest.update({
          where: { id: requestId },
          data: { deliveryCodeAttempts: { increment: 1 } },
        });
        return "badCode" as const;
      }
    }
    await completeStep(tx, actor, request, step, opts.location ?? null, "DRIVER_APP");
    return "ok" as const;
  });
  if (outcome === "badCode") throw new InvalidStateError("odf.errors.badCode");
  if (opts.location) await reportLocation(ctx, opts.location).catch(() => undefined);
}

// ---------------------------------------------------------------- Frota (prestador)

export async function listFleet(ctx: ActorContext) {
  assertPermission(ctx, "odf.fleet.manage");
  const db = tenantDb(ctx.organizationId);
  const [vehicles, drivers, profile] = await Promise.all([
    db.vehicle.findMany({ orderBy: { plate: "asc" }, include: { driver: { select: { id: true, name: true } } } }),
    db.membership.findMany({
      where: { status: "ACTIVE", role: { key: "DRIVER" } },
      select: { user: { select: { id: true, name: true, email: true, driverPresence: true } } },
    }),
    db.providerProfile.findFirst(),
  ]);
  const trust = (await providerTrustScores([ctx.organizationId])).get(ctx.organizationId) ?? null;
  return { vehicles, drivers: drivers.map((d) => d.user), profile, trust };
}

async function assertDriverMember(ctx: ActorContext, userId: string) {
  const m = await tenantDb(ctx.organizationId).membership.findFirst({
    where: { userId, status: "ACTIVE", role: { key: "DRIVER" } },
  });
  if (!m) throw new InvalidStateError("odf.errors.notADriver");
}

export async function saveVehicle(ctx: ActorContext, input: VehicleInput, id?: string) {
  assertPermission(ctx, "odf.fleet.manage");
  if (input.driverUserId) await assertDriverMember(ctx, input.driverUserId);
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    const before = id ? await tx.vehicle.findUnique({ where: { id } }) : null;
    if (id && !before) throw new NotFoundError();
    if (before?.driverUserId && before.driverUserId !== input.driverUserId) {
      const busy = await tx.freightRequest.count({
        where: { vehicleId: id, status: { in: ACTIVE } },
      });
      const busyElsewhere = await prisma.freightRequest.count({ where: { vehicleId: id, status: { in: ACTIVE } } });
      if (busy + busyElsewhere > 0) throw new InvalidStateError("odf.errors.vehicleOnTrip");
    }
    if (input.driverUserId) {
      // Um motorista conduz uma viatura de cada vez.
      await tx.vehicle.updateMany({
        where: { driverUserId: input.driverUserId, ...(id ? { id: { not: id } } : {}) },
        data: { driverUserId: null },
      });
    }
    const vehicle = id
      ? await tx.vehicle.update({ where: { id }, data: input })
      : await tx.vehicle.create({ data: { ...input, organizationId: ctx.organizationId } });
    await recordAudit(tx, ctx, {
      action: id ? "vehicle.updated" : "vehicle.created",
      entityType: "Vehicle",
      entityId: vehicle.id,
      before,
      after: vehicle,
    });
    return vehicle;
  });
}

/** Corridas executadas pela frota (sem o código de entrega nem contactos do expedidor). */
export async function listFleetJobs(ctx: ActorContext) {
  if (!hasPermission(ctx, "odf.jobs.read")) assertPermission(ctx, "odf.fleet.manage");
  return prisma.freightRequest.findMany({
    where: { providerOrganizationId: ctx.organizationId },
    select: {
      id: true,
      reference: true,
      status: true,
      category: true,
      pickupLabel: true,
      dropoffLabel: true,
      distanceKm: true,
      currency: true,
      priceBreakdown: true,
      acceptedAt: true,
      deliveredAt: true,
      rating: true,
      driver: { select: { name: true } },
      vehicle: { select: { plate: true } },
    },
    orderBy: { acceptedAt: "desc" },
    take: 100,
  });
}

export { MAX_PICKUP_RADIUS_KM };
