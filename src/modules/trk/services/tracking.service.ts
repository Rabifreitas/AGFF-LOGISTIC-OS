import { InvalidStateError, NotFoundError } from "@/lib/errors";
import { recordAudit } from "@/modules/audit/audit.service";
import { assertPermission, type ActorContext } from "@/modules/iam/rbac";
import { applyShipmentTransition } from "@/modules/shp/services/shipment.service";
import { canTransitionShipment } from "@/modules/shp/shipment-status";
import { tenantDb } from "@/modules/tenancy/tenant-db";
import type { TrackingEventInput } from "../schemas";
import { planTrackingEvent } from "../tracking-codes";

export async function listTrackingEvents(ctx: ActorContext, shipmentId?: string) {
  assertPermission(ctx, "trk.events.read");
  return tenantDb(ctx.organizationId).trackingEvent.findMany({
    where: shipmentId ? { shipmentId } : {},
    include: { shipment: { select: { id: true, reference: true, status: true } } },
    orderBy: { occurredAt: "desc" },
    take: 200,
  });
}

/**
 * Regista um evento (imutável) e, quando o código o implica, avança o estado da expedição
 * pela máquina de estados — nunca permite saltos inválidos.
 */
export async function recordTrackingEvent(ctx: ActorContext, shipmentId: string, input: TrackingEventInput) {
  assertPermission(ctx, "trk.events.create");
  if (input.occurredAt.getTime() > Date.now() + 5 * 60_000) throw new InvalidStateError("trk.futureEvent");
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) throw new NotFoundError();
    const plan = planTrackingEvent(shipment.status, input.code, (t) => canTransitionShipment(shipment.status, t));
    if ("error" in plan) throw new InvalidStateError(plan.error);
    const event = await tx.trackingEvent.create({
      data: { ...input, shipmentId, source: "MANUAL", reportedById: ctx.userId, organizationId: ctx.organizationId },
    });
    await recordAudit(tx, ctx, {
      action: "tracking.event.recorded",
      entityType: "TrackingEvent",
      entityId: event.id,
      after: event,
    });
    const status = plan.transition
      ? await applyShipmentTransition(tx, ctx, shipmentId, plan.transition)
      : shipment.status;
    return { event, status };
  });
}
