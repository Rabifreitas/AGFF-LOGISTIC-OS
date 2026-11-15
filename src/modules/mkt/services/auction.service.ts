import type { Prisma, TransportMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ConflictError, ForbiddenError, InvalidStateError, NotFoundError } from "@/lib/errors";
import { recordAudit } from "@/modules/audit/audit.service";
import { assertPermission, hasPermission, type ActorContext } from "@/modules/iam/rbac";
import { applyShipmentTransition } from "@/modules/shp/services/shipment.service";
import { tenantDb } from "@/modules/tenancy/tenant-db";
import {
  bidsVisibleToOwner,
  buildAuctionSnapshot,
  closesAtError,
  isBiddingOpen,
  isProviderActive,
  nextProviderStatus,
  providerEligibleFor,
} from "../auction-rules";
import type { AuctionInput, BidInput, ProviderProfileInput, ProviderReviewInput } from "../auction-schemas";

/**
 * Leilão cego com tempo limite. O leilão pertence ao expedidor (tenant) e cada proposta
 * à organização licitante. As leituras entre empresas usam o cliente base com select
 * explícito: os prestadores nunca recebem moradas, contactos, nome do expedidor nem
 * propostas de concorrentes; o expedidor só vê as propostas depois do fecho.
 */

const PUBLIC_AUCTION_SELECT = {
  id: true,
  reference: true,
  status: true,
  closesAt: true,
  modes: true,
  services: true,
  currency: true,
  originCity: true,
  originCountry: true,
  destinationCity: true,
  destinationCountry: true,
  pickupFrom: true,
  deliveryBy: true,
  cargoSummary: true,
  totalWeightKg: true,
  totalVolumeM3: true,
  hazardous: true,
  publicNotes: true,
  createdAt: true,
} satisfies Prisma.AuctionSelect;

const OWN_BID_SELECT = {
  id: true,
  status: true,
  amount: true,
  currency: true,
  mode: true,
  transitDays: true,
  validUntil: true,
  notes: true,
  updatedAt: true,
} satisfies Prisma.AuctionBidSelect;

/** Fecha leilões vencidos (idempotente). Chamado em cada leitura e pelo endpoint de cron. */
export async function sweepDueAuctions(now = new Date()) {
  const closed = await prisma.auction.updateMany({
    where: { status: "OPEN", closesAt: { lte: now }, bids: { some: { status: "SUBMITTED" } } },
    data: { status: "CLOSED", closedAt: now },
  });
  const expired = await prisma.auction.updateMany({
    where: { status: "OPEN", closesAt: { lte: now } },
    data: { status: "EXPIRED", closedAt: now },
  });
  return { closed: closed.count, expired: expired.count };
}

// ---------------------------------------------------------------- Perfil de prestador

export async function getOwnProviderProfile(ctx: ActorContext) {
  if (!hasPermission(ctx, "mkt.provider.manage")) assertPermission(ctx, "mkt.bids.read");
  return tenantDb(ctx.organizationId).providerProfile.findFirst();
}

export async function saveProviderProfile(ctx: ActorContext, input: ProviderProfileInput) {
  assertPermission(ctx, "mkt.provider.manage");
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    const before = await tx.providerProfile.findFirst();
    const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));
    const scopeChanged = before && (!same(before.modes, input.modes) || !same(before.services, input.services));
    const after = before
      ? await tx.providerProfile.update({
          where: { id: before.id },
          // Alterar modos/serviços de um perfil verificado exige nova verificação.
          data: { ...input, ...(scopeChanged && before.status === "VERIFIED" ? { status: "PENDING" } : {}) },
        })
      : await tx.providerProfile.create({ data: { ...input, organizationId: ctx.organizationId } });
    await recordAudit(tx, ctx, {
      action: before ? "provider.updated" : "provider.created",
      entityType: "ProviderProfile",
      entityId: after.id,
      before,
      after,
    });
    return after;
  });
}

export async function submitProviderProfile(ctx: ActorContext) {
  assertPermission(ctx, "mkt.provider.manage");
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    const before = await tx.providerProfile.findFirst();
    if (!before) throw new NotFoundError();
    if (before.modes.length === 0 && before.services.length === 0)
      throw new InvalidStateError("mkt.provider.needsScope");
    const to = nextProviderStatus(before.status, "submit");
    if (!to) throw new InvalidStateError("mkt.provider.invalidTransition");
    const after = await tx.providerProfile.update({
      where: { id: before.id },
      data: { status: to, statusReason: null },
    });
    await recordAudit(tx, ctx, {
      action: "provider.submitted",
      entityType: "ProviderProfile",
      entityId: before.id,
      before,
      after,
    });
    return after;
  });
}

export async function listProviderProfiles(ctx: ActorContext) {
  assertPermission(ctx, "platform.providers.verify");
  return prisma.providerProfile.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 500,
    include: { organization: { select: { id: true, name: true, nif: true, type: true, country: true } } },
  });
}

export async function reviewProviderProfile(ctx: ActorContext, id: string, input: ProviderReviewInput) {
  assertPermission(ctx, "platform.providers.verify");
  const now = new Date();
  if (input.validUntil && input.validUntil <= now) throw new InvalidStateError("mkt.provider.validityPast");
  return prisma.$transaction(async (tx) => {
    const before = await tx.providerProfile.findUnique({ where: { id } });
    if (!before) throw new NotFoundError();
    const to = nextProviderStatus(before.status, input.decision);
    if (!to) throw new InvalidStateError("mkt.provider.invalidTransition");
    const verifying = input.decision === "verify" || input.decision === "reactivate";
    const after = await tx.providerProfile.update({
      where: { id },
      data: {
        status: to,
        statusReason: input.reason,
        ...(verifying
          ? { verifiedAt: now, verifiedById: ctx.userId, validUntil: input.validUntil ?? before.validUntil }
          : {}),
      },
    });
    await recordAudit(tx, ctx, {
      action: `provider.${input.decision}`,
      entityType: "ProviderProfile",
      entityId: id,
      organizationId: before.organizationId,
      before,
      after,
    });
    return after;
  });
}

// ---------------------------------------------------------------- Expedidor

type Tx = Parameters<Parameters<ReturnType<typeof tenantDb>["$transaction"]>[0]>[0];

async function nextAuctionReference(tx: Tx, organizationId: string, now: Date) {
  const year = now.getUTCFullYear();
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`auction-ref:${organizationId}:${year}`}))`;
  const last = await tx.auction.findFirst({
    where: { reference: { startsWith: `LEI-${year}-` } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const seq = last ? Number(last.reference.split("-")[2]) + 1 : 1;
  return `LEI-${year}-${String(seq).padStart(5, "0")}`;
}

export async function createAuction(ctx: ActorContext, input: AuctionInput) {
  assertPermission(ctx, "mkt.auctions.manage");
  const now = new Date();
  const windowError = closesAtError(input.closesAt, now);
  if (windowError) throw new InvalidStateError(windowError);
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    const found = await tx.shipment.findUnique({ where: { id: input.shipmentId }, select: { id: true } });
    if (!found) throw new NotFoundError();
    await tx.$executeRaw`SELECT 1 FROM "shipments" WHERE "id" = ${found.id} FOR NO KEY UPDATE`;
    const s = await tx.shipment.findUnique({
      where: { id: found.id },
      include: { stops: { orderBy: { sequence: "asc" } }, items: true },
    });
    if (!s) throw new NotFoundError();
    if (s.status !== "REQUESTED") throw new InvalidStateError("mkt.auction.shipmentNotRequested");
    const active = await tx.auction.count({ where: { shipmentId: s.id, status: { in: ["OPEN", "CLOSED"] } } });
    if (active > 0) throw new ConflictError("mkt.auction.alreadyActive");
    const snapshot = buildAuctionSnapshot(s);
    if (!snapshot) throw new InvalidStateError("shp.needsRouteAndCargo");
    const created = await tx.auction.create({
      data: {
        organizationId: ctx.organizationId,
        shipmentId: s.id,
        reference: await nextAuctionReference(tx, ctx.organizationId, now),
        closesAt: input.closesAt,
        modes: input.modes,
        services: input.services.length > 0 ? input.services : s.services,
        currency: input.currency,
        publicNotes: input.publicNotes,
        createdById: ctx.userId,
        ...snapshot,
      },
    });
    await recordAudit(tx, ctx, {
      action: "auction.published",
      entityType: "Auction",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

export async function listOwnAuctions(ctx: ActorContext) {
  assertPermission(ctx, "mkt.auctions.read");
  await sweepDueAuctions();
  const auctions = await tenantDb(ctx.organizationId).auction.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { shipment: { select: { id: true, reference: true } } },
  });
  const counts = await prisma.auctionBid.groupBy({
    by: ["auctionId"],
    where: { auctionId: { in: auctions.map((a) => a.id) }, status: { not: "WITHDRAWN" } },
    _count: { _all: true },
  });
  const byId = new Map(counts.map((c) => [c.auctionId, c._count._all]));
  return auctions.map((a) => ({ ...a, bidCount: byId.get(a.id) ?? 0 }));
}

export async function getOwnAuction(ctx: ActorContext, id: string) {
  assertPermission(ctx, "mkt.auctions.read");
  await sweepDueAuctions();
  const auction = await tenantDb(ctx.organizationId).auction.findUnique({
    where: { id },
    include: { shipment: { select: { id: true, reference: true, status: true, mode: true } } },
  });
  if (!auction) throw new NotFoundError();
  const where = { auctionId: id, status: { not: "WITHDRAWN" as const } };
  const bidCount = await prisma.auctionBid.count({ where });
  const bids = bidsVisibleToOwner(auction)
    ? await prisma.auctionBid.findMany({
        where,
        orderBy: { amount: "asc" },
        select: {
          ...OWN_BID_SELECT,
          organization: {
            select: {
              id: true,
              name: true,
              country: true,
              providerProfile: { select: { status: true, validUntil: true } },
            },
          },
        },
      })
    : [];
  return { auction, bidCount, bids };
}

async function lockAuction(tx: { $executeRaw: Tx["$executeRaw"] }, id: string) {
  await tx.$executeRaw`SELECT 1 FROM "auctions" WHERE "id" = ${id} FOR NO KEY UPDATE`;
}

export async function cancelAuction(ctx: ActorContext, id: string) {
  assertPermission(ctx, "mkt.auctions.manage");
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    const found = await tx.auction.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundError();
    await lockAuction(tx, id);
    const before = await tx.auction.findUnique({ where: { id } });
    if (!before || (before.status !== "OPEN" && before.status !== "CLOSED")) {
      throw new InvalidStateError("mkt.auction.notCancellable");
    }
    await tx.auction.update({ where: { id }, data: { status: "CANCELLED", closedAt: new Date() } });
    await tx.$executeRaw`UPDATE "auction_bids" SET "status" = 'LOST'::"BidStatus", "updated_at" = now() WHERE "auction_id" = ${id} AND "status" = 'SUBMITTED'::"BidStatus"`;
    await recordAudit(tx, ctx, {
      action: "auction.cancelled",
      entityType: "Auction",
      entityId: id,
      before: { status: before.status },
      after: { status: "CANCELLED" },
    });
  });
}

type RawBid = {
  id: string;
  organization_id: string;
  status: string;
  amount: Prisma.Decimal;
  currency: string;
  mode: string;
  transit_days: number;
  valid_until: Date | null;
};

/**
 * Adjudica uma proposta depois do fecho: o prestador passa a parceiro verificado do expedidor
 * (verificação MARKETPLACE), fica registada a cotação aceite e a expedição é reservada com as
 * mesmas regras de modo/verificação das reservas manuais.
 */
export async function awardAuction(ctx: ActorContext, auctionId: string, bidId: string) {
  assertPermission(ctx, "mkt.auctions.manage");
  await sweepDueAuctions();
  const now = new Date();
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    const found = await tx.auction.findUnique({ where: { id: auctionId }, select: { id: true } });
    if (!found) throw new NotFoundError();
    await lockAuction(tx, auctionId);
    const auction = await tx.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new NotFoundError();
    if (auction.status !== "CLOSED") throw new InvalidStateError("mkt.auction.notClosed");

    const [bid] = await tx.$queryRaw<RawBid[]>`
      SELECT "id", "organization_id", "status"::text AS "status", "amount", "currency", "mode"::text AS "mode",
             "transit_days", "valid_until"
      FROM "auction_bids" WHERE "id" = ${bidId} AND "auction_id" = ${auctionId} FOR UPDATE`;
    if (!bid) throw new NotFoundError("mkt.bid.notFound");
    if (bid.status !== "SUBMITTED") throw new InvalidStateError("mkt.bid.notActive");
    if (bid.valid_until && bid.valid_until < now) throw new InvalidStateError("mkt.bid.expired");

    const bidder = await prisma.organization.findUnique({
      where: { id: bid.organization_id },
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
    });
    const profile = bidder?.providerProfile;
    if (!bidder || bidder.status !== "ACTIVE" || !profile || !isProviderActive(profile, now)) {
      throw new InvalidStateError("mkt.bid.providerNotVerified");
    }

    const existing = await tx.partner.findFirst({ where: { linkedOrganizationId: bidder.id } });
    if (existing && (existing.status === "SUSPENDED" || existing.status === "REJECTED")) {
      throw new InvalidStateError("mkt.award.partnerBlocked");
    }
    const partnerData = { modes: profile.modes, services: profile.services, status: "VERIFIED" as const };
    const partner = existing
      ? await tx.partner.update({ where: { id: existing.id }, data: partnerData })
      : await tx.partner.create({
          data: {
            organizationId: ctx.organizationId,
            linkedOrganizationId: bidder.id,
            type: bidder.type === "FREIGHT_FORWARDER" ? "FREIGHT_FORWARDER" : "TRANSPORTER",
            name: bidder.name,
            nif: bidder.nif,
            country: bidder.country,
            email: bidder.email,
            phone: bidder.phone,
            ...partnerData,
          },
        });
    await tx.partnerVerification.create({
      data: {
        organizationId: ctx.organizationId,
        partnerId: partner.id,
        kind: "MARKETPLACE",
        status: "APPROVED",
        reviewedById: ctx.userId,
        reviewedAt: now,
        expiresAt: profile.validUntil,
        notes: auction.reference,
      },
    });

    const shipment = await tx.shipment.findUnique({ where: { id: auction.shipmentId } });
    if (!shipment) throw new NotFoundError();
    if (shipment.status !== "REQUESTED" && shipment.status !== "QUOTED") {
      throw new InvalidStateError("mkt.award.shipmentNotOpen");
    }
    await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        carrierPartnerId: partner.id,
        ...(shipment.mode !== "MULTIMODAL" ? { mode: bid.mode as TransportMode } : {}),
      },
    });
    await tx.quotation.create({
      data: {
        organizationId: ctx.organizationId,
        shipmentId: shipment.id,
        partnerId: partner.id,
        reference: auction.reference,
        status: "ACCEPTED",
        currency: bid.currency,
        amount: bid.amount,
        validUntil: bid.valid_until,
        notes: `${auction.reference} · ${bid.transit_days}d · ${bid.mode}`,
      },
    });
    if (shipment.status === "REQUESTED") await applyShipmentTransition(tx, ctx, shipment.id, "markQuoted");
    await applyShipmentTransition(tx, ctx, shipment.id, "book");

    await tx.$executeRaw`UPDATE "auction_bids" SET "status" = 'ACCEPTED'::"BidStatus", "updated_at" = now() WHERE "id" = ${bid.id}`;
    await tx.$executeRaw`UPDATE "auction_bids" SET "status" = 'LOST'::"BidStatus", "updated_at" = now() WHERE "auction_id" = ${auctionId} AND "id" <> ${bid.id} AND "status" = 'SUBMITTED'::"BidStatus"`;
    const { count } = await tx.auction.updateMany({
      where: { id: auctionId, status: "CLOSED" },
      data: { status: "AWARDED", awardedBidId: bid.id },
    });
    if (count !== 1) throw new InvalidStateError("shp.concurrentChange");
    await recordAudit(tx, ctx, {
      action: "auction.awarded",
      entityType: "Auction",
      entityId: auctionId,
      before: { status: "CLOSED" },
      after: {
        status: "AWARDED",
        bidId: bid.id,
        provider: bidder.name,
        amount: bid.amount.toString(),
        currency: bid.currency,
      },
    });
    return { partnerId: partner.id, shipmentId: shipment.id };
  });
}

// ---------------------------------------------------------------- Prestador

async function activeProfile(ctx: ActorContext, now: Date) {
  const profile = await tenantDb(ctx.organizationId).providerProfile.findFirst();
  return { profile, active: profile && isProviderActive(profile, now) ? profile : null };
}

export async function listMarketplace(ctx: ActorContext, filter: { mode?: TransportMode } = {}) {
  assertPermission(ctx, "mkt.bids.read");
  await sweepDueAuctions();
  const now = new Date();
  const { profile, active } = await activeProfile(ctx, now);
  if (!active) return { profile, auctions: [] };
  const modes = filter.mode ? active.modes.filter((m) => m === filter.mode) : active.modes;
  const rows = await prisma.auction.findMany({
    where: {
      status: "OPEN",
      closesAt: { gt: now },
      organizationId: { not: ctx.organizationId },
      modes: { hasSome: modes },
    },
    orderBy: { closesAt: "asc" },
    take: 200,
    select: {
      ...PUBLIC_AUCTION_SELECT,
      bids: { where: { organizationId: ctx.organizationId }, select: OWN_BID_SELECT },
    },
  });
  return {
    profile,
    auctions: rows
      .filter((a) => providerEligibleFor(active, a, now))
      .map(({ bids, ...a }) => ({ ...a, myBid: bids[0] ?? null })),
  };
}

export async function getMarketplaceAuction(ctx: ActorContext, id: string) {
  assertPermission(ctx, "mkt.bids.read");
  await sweepDueAuctions();
  const now = new Date();
  const { profile, active } = await activeProfile(ctx, now);
  const row = await prisma.auction.findUnique({
    where: { id },
    select: {
      ...PUBLIC_AUCTION_SELECT,
      organizationId: true,
      bids: { where: { organizationId: ctx.organizationId }, select: OWN_BID_SELECT },
    },
  });
  if (!row || row.organizationId === ctx.organizationId) throw new NotFoundError();
  const { organizationId: shipperOrgId, bids, ...auction } = row;
  const myBid = bids[0] ?? null;
  const eligible = !!active && isBiddingOpen(auction, now) && providerEligibleFor(active, auction, now);
  // Quem não pode licitar nem licitou não vê o pedido.
  if (!myBid && !eligible) throw new NotFoundError();
  // Só o vencedor fica a conhecer o expedidor.
  const shipper =
    myBid?.status === "ACCEPTED"
      ? await prisma.organization.findUnique({
          where: { id: shipperOrgId },
          select: { name: true, email: true, phone: true },
        })
      : null;
  return { auction, myBid, profile, shipper, canBid: eligible && hasPermission(ctx, "mkt.bids.manage") };
}

export async function placeBid(ctx: ActorContext, auctionId: string, input: BidInput) {
  assertPermission(ctx, "mkt.bids.manage");
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await lockAuction(tx, auctionId);
    const a = await tx.auction.findUnique({
      where: { id: auctionId },
      select: {
        id: true,
        organizationId: true,
        status: true,
        closesAt: true,
        modes: true,
        services: true,
        currency: true,
      },
    });
    if (!a || a.organizationId === ctx.organizationId) throw new NotFoundError();
    if (!isBiddingOpen(a, now)) throw new InvalidStateError("mkt.auction.closed");
    const profile = await tx.providerProfile.findUnique({ where: { organizationId: ctx.organizationId } });
    if (!profile || !providerEligibleFor(profile, a, now)) throw new ForbiddenError("mkt.bid.notEligible");
    if (!a.modes.includes(input.mode)) throw new InvalidStateError("mkt.bid.modeNotAccepted");
    if (!profile.modes.includes(input.mode)) throw new InvalidStateError("mkt.bid.modeNotOffered");
    if (input.validUntil && input.validUntil < a.closesAt) throw new InvalidStateError("mkt.bid.validityTooShort");
    const data = {
      status: "SUBMITTED" as const,
      amount: input.amount,
      currency: a.currency,
      mode: input.mode,
      transitDays: input.transitDays,
      validUntil: input.validUntil,
      notes: input.notes,
      submittedById: ctx.userId,
    };
    const key = { auctionId_organizationId: { auctionId, organizationId: ctx.organizationId } };
    const before = await tx.auctionBid.findUnique({ where: key });
    const bid = before
      ? await tx.auctionBid.update({ where: key, data })
      : await tx.auctionBid.create({ data: { ...data, auctionId, organizationId: ctx.organizationId } });
    // Auditado só na organização licitante: o expedidor não vê valores antes do fecho.
    await recordAudit(tx, ctx, {
      action: before ? "bid.updated" : "bid.submitted",
      entityType: "AuctionBid",
      entityId: bid.id,
      before,
      after: bid,
    });
    return bid;
  });
}

export async function withdrawBid(ctx: ActorContext, auctionId: string) {
  assertPermission(ctx, "mkt.bids.manage");
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await lockAuction(tx, auctionId);
    const a = await tx.auction.findUnique({ where: { id: auctionId }, select: { status: true, closesAt: true } });
    if (!a) throw new NotFoundError();
    if (!isBiddingOpen(a, now)) throw new InvalidStateError("mkt.auction.closed");
    const key = { auctionId_organizationId: { auctionId, organizationId: ctx.organizationId } };
    const before = await tx.auctionBid.findUnique({ where: key });
    if (!before || before.status !== "SUBMITTED") throw new NotFoundError("mkt.bid.notFound");
    const after = await tx.auctionBid.update({ where: key, data: { status: "WITHDRAWN" } });
    await recordAudit(tx, ctx, {
      action: "bid.withdrawn",
      entityType: "AuctionBid",
      entityId: before.id,
      before,
      after,
    });
  });
}

export async function listOwnBids(ctx: ActorContext) {
  assertPermission(ctx, "mkt.bids.read");
  await sweepDueAuctions();
  return prisma.auctionBid.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: { ...OWN_BID_SELECT, auction: { select: PUBLIC_AUCTION_SELECT } },
  });
}
