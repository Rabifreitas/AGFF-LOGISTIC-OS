import type { Prisma, ShipmentStatus } from "@prisma/client";
import { InvalidStateError, NotFoundError } from "@/lib/errors";
import { recordAudit } from "@/modules/audit/audit.service";
import { assertPermission, type ActorContext } from "@/modules/iam/rbac";
import { canBeBookedAsCarrier } from "@/modules/mkt/partner-status";
import { tenantDb } from "@/modules/tenancy/tenant-db";
import type { ItemInput, ShipmentInput, StopInput } from "../schemas";
import {
  formatShipmentReference,
  isShipmentEditable,
  nextShipmentStatus,
  shipmentTransitionBlocker,
  type ShipmentTransition,
} from "../shipment-status";

type Tx = Parameters<Parameters<ReturnType<typeof tenantDb>["$transaction"]>[0]>[0];

const CARRIER_TYPES = ["TRANSPORTER", "FREIGHT_FORWARDER"];

/** Garante que parceiros e centro de custo referenciados pertencem ao tenant actual. */
async function assertRelationsInTenant(
  tx: Tx,
  input: Pick<ShipmentInput, "customerPartnerId" | "carrierPartnerId" | "costCenterId">,
) {
  if (input.customerPartnerId) {
    const p = await tx.partner.findUnique({ where: { id: input.customerPartnerId } });
    if (!p) throw new NotFoundError("shp.customerNotFound");
  }
  if (input.carrierPartnerId) {
    const p = await tx.partner.findUnique({ where: { id: input.carrierPartnerId } });
    if (!p) throw new NotFoundError("shp.carrierNotFound");
    if (!CARRIER_TYPES.includes(p.type)) throw new InvalidStateError("shp.carrierType");
  }
  if (input.costCenterId) {
    const cc = await tx.costCenter.findUnique({ where: { id: input.costCenterId } });
    if (!cc || !cc.active) throw new NotFoundError("shp.costCenterNotFound");
  }
}

function assertDates(input: Pick<ShipmentInput, "plannedPickupAt" | "plannedDeliveryAt">) {
  if (input.plannedPickupAt && input.plannedDeliveryAt && input.plannedDeliveryAt < input.plannedPickupAt) {
    throw new InvalidStateError("shp.deliveryBeforePickup");
  }
}

async function nextReference(tx: Tx, organizationId: string, now = new Date()) {
  const year = now.getUTCFullYear();
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shipment-ref:${organizationId}:${year}`}))`;
  const last = await tx.shipment.findFirst({
    where: { reference: { startsWith: `SHP-${year}-` } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const seq = last ? Number(last.reference.split("-")[2]) + 1 : 1;
  return formatShipmentReference(year, seq);
}

async function loadEditable(tx: Tx, shipmentId: string) {
  const s = await tx.shipment.findUnique({ where: { id: shipmentId } });
  if (!s) throw new NotFoundError();
  if (!isShipmentEditable(s.status)) throw new InvalidStateError("shp.notEditable");
  return s;
}

export async function listShipments(ctx: ActorContext, filter: { status?: ShipmentStatus; q?: string } = {}) {
  assertPermission(ctx, "tms.shipments.read");
  const where: Prisma.ShipmentWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.q) where.reference = { contains: filter.q, mode: "insensitive" };
  return tenantDb(ctx.organizationId).shipment.findMany({
    where,
    include: {
      carrierPartner: { select: { id: true, name: true } },
      customerPartner: { select: { id: true, name: true } },
      stops: { orderBy: { sequence: "asc" }, select: { type: true, city: true, country: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getShipment(ctx: ActorContext, id: string) {
  assertPermission(ctx, "tms.shipments.read");
  const s = await tenantDb(ctx.organizationId).shipment.findUnique({
    where: { id },
    include: {
      carrierPartner: true,
      customerPartner: true,
      costCenter: true,
      stops: { orderBy: { sequence: "asc" } },
      items: { orderBy: { id: "asc" } },
      trackingEvents: { orderBy: { occurredAt: "desc" } },
      incidents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!s) throw new NotFoundError();
  return s;
}

export async function createShipment(ctx: ActorContext, input: ShipmentInput) {
  assertPermission(ctx, "tms.shipments.manage");
  assertDates(input);
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    await assertRelationsInTenant(tx, input);
    const reference = await nextReference(tx, ctx.organizationId);
    const created = await tx.shipment.create({
      data: { ...input, reference, createdById: ctx.userId, organizationId: ctx.organizationId },
    });
    await recordAudit(tx, ctx, {
      action: "shipment.created",
      entityType: "Shipment",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

export async function updateShipment(ctx: ActorContext, id: string, input: ShipmentInput) {
  assertPermission(ctx, "tms.shipments.manage");
  assertDates(input);
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    const before = await loadEditable(tx, id);
    await assertRelationsInTenant(tx, input);
    const after = await tx.shipment.update({ where: { id }, data: input });
    await recordAudit(tx, ctx, { action: "shipment.updated", entityType: "Shipment", entityId: id, before, after });
    return after;
  });
}

/** Aplica uma transição dentro de uma transacção existente (usado também pelo tracking). */
export async function applyShipmentTransition(tx: Tx, ctx: ActorContext, id: string, transition: ShipmentTransition) {
  const before = await tx.shipment.findUnique({
    where: { id },
    include: { stops: { select: { type: true } }, items: { select: { id: true } }, carrierPartner: true },
  });
  if (!before) throw new NotFoundError();
  const to = nextShipmentStatus(before.status, transition);
  if (!to) throw new InvalidStateError("shp.invalidTransition");
  const blocker = shipmentTransitionBlocker(transition, before);
  if (blocker) throw new InvalidStateError(blocker);
  if (transition === "book" && before.carrierPartner && !canBeBookedAsCarrier(before.carrierPartner)) {
    throw new InvalidStateError("shp.carrierNotVerified");
  }
  // Guarda optimista: falha se outro pedido mudou o estado entretanto.
  const { count } = await tx.shipment.updateMany({ where: { id, status: before.status }, data: { status: to } });
  if (count !== 1) throw new InvalidStateError("shp.concurrentChange");
  await recordAudit(tx, ctx, {
    action: `shipment.${transition}`,
    entityType: "Shipment",
    entityId: id,
    before: { status: before.status },
    after: { status: to },
  });
  return to;
}

export async function transitionShipment(ctx: ActorContext, id: string, transition: ShipmentTransition) {
  assertPermission(ctx, "tms.shipments.manage");
  return tenantDb(ctx.organizationId).$transaction((tx) => applyShipmentTransition(tx, ctx, id, transition));
}

export async function addStop(ctx: ActorContext, shipmentId: string, input: StopInput) {
  assertPermission(ctx, "tms.shipments.manage");
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    await loadEditable(tx, shipmentId);
    const last = await tx.shipmentStop.findFirst({ where: { shipmentId }, orderBy: { sequence: "desc" } });
    const created = await tx.shipmentStop.create({
      data: { ...input, shipmentId, sequence: (last?.sequence ?? 0) + 1, organizationId: ctx.organizationId },
    });
    await recordAudit(tx, ctx, {
      action: "shipment.stop.added",
      entityType: "ShipmentStop",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

export async function moveStop(ctx: ActorContext, stopId: string, direction: "up" | "down") {
  assertPermission(ctx, "tms.shipments.manage");
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    const stop = await tx.shipmentStop.findUnique({ where: { id: stopId } });
    if (!stop) throw new NotFoundError();
    await loadEditable(tx, stop.shipmentId);
    const neighbour = await tx.shipmentStop.findFirst({
      where: {
        shipmentId: stop.shipmentId,
        sequence: direction === "up" ? { lt: stop.sequence } : { gt: stop.sequence },
      },
      orderBy: { sequence: direction === "up" ? "desc" : "asc" },
    });
    if (!neighbour) return stop;
    await tx.shipmentStop.update({ where: { id: stop.id }, data: { sequence: -1 } });
    await tx.shipmentStop.update({ where: { id: neighbour.id }, data: { sequence: stop.sequence } });
    const after = await tx.shipmentStop.update({ where: { id: stop.id }, data: { sequence: neighbour.sequence } });
    await recordAudit(tx, ctx, {
      action: "shipment.stop.moved",
      entityType: "ShipmentStop",
      entityId: stop.id,
      before: { sequence: stop.sequence },
      after: { sequence: after.sequence },
    });
    return after;
  });
}

export async function removeStop(ctx: ActorContext, stopId: string) {
  assertPermission(ctx, "tms.shipments.manage");
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    const stop = await tx.shipmentStop.findUnique({ where: { id: stopId } });
    if (!stop) throw new NotFoundError();
    await loadEditable(tx, stop.shipmentId);
    await tx.shipmentStop.delete({ where: { id: stopId } });
    await recordAudit(tx, ctx, {
      action: "shipment.stop.removed",
      entityType: "ShipmentStop",
      entityId: stopId,
      before: stop,
    });
  });
}

export async function addItem(ctx: ActorContext, shipmentId: string, input: ItemInput) {
  assertPermission(ctx, "tms.shipments.manage");
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    await loadEditable(tx, shipmentId);
    const created = await tx.shipmentItem.create({
      data: { ...input, shipmentId, organizationId: ctx.organizationId },
    });
    await recordAudit(tx, ctx, {
      action: "shipment.item.added",
      entityType: "ShipmentItem",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

export async function removeItem(ctx: ActorContext, itemId: string) {
  assertPermission(ctx, "tms.shipments.manage");
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    const item = await tx.shipmentItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundError();
    await loadEditable(tx, item.shipmentId);
    await tx.shipmentItem.delete({ where: { id: itemId } });
    await recordAudit(tx, ctx, {
      action: "shipment.item.removed",
      entityType: "ShipmentItem",
      entityId: itemId,
      before: item,
    });
  });
}
