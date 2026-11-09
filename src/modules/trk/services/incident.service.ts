import type { IncidentStatus } from "@prisma/client";
import { InvalidStateError, NotFoundError } from "@/lib/errors";
import { recordAudit } from "@/modules/audit/audit.service";
import { assertPermission, type ActorContext } from "@/modules/iam/rbac";
import { tenantDb } from "@/modules/tenancy/tenant-db";
import { nextIncidentStatus, type IncidentTransition } from "../incident-status";
import type { IncidentInput } from "../schemas";

export async function listIncidents(ctx: ActorContext, filter: { status?: IncidentStatus; shipmentId?: string } = {}) {
  assertPermission(ctx, "incidents.read");
  return tenantDb(ctx.organizationId).incident.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.shipmentId ? { shipmentId: filter.shipmentId } : {}),
    },
    include: { shipment: { select: { id: true, reference: true } } },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });
}

export async function openIncident(ctx: ActorContext, input: IncidentInput) {
  assertPermission(ctx, "incidents.manage");
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    if (input.shipmentId) {
      const s = await tx.shipment.findUnique({ where: { id: input.shipmentId } });
      if (!s) throw new NotFoundError();
    }
    const created = await tx.incident.create({
      data: { ...input, reportedById: ctx.userId, organizationId: ctx.organizationId },
    });
    await recordAudit(tx, ctx, {
      action: "incident.opened",
      entityType: "Incident",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

export async function transitionIncident(
  ctx: ActorContext,
  id: string,
  transition: IncidentTransition,
  resolution?: string | null,
) {
  assertPermission(ctx, "incidents.manage");
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    const before = await tx.incident.findUnique({ where: { id } });
    if (!before) throw new NotFoundError();
    const to = nextIncidentStatus(before.status, transition);
    if (!to) throw new InvalidStateError("incidents.invalidTransition");
    if (transition === "resolve" && !resolution?.trim()) throw new InvalidStateError("incidents.resolutionRequired");
    const data =
      transition === "resolve"
        ? { status: to, resolution: resolution!.trim(), resolvedAt: new Date() }
        : transition === "reopen"
          ? { status: to, resolvedAt: null }
          : { status: to };
    const { count } = await tx.incident.updateMany({ where: { id, status: before.status }, data });
    if (count !== 1) throw new InvalidStateError("incidents.concurrentChange");
    const after = await tx.incident.findUniqueOrThrow({ where: { id } });
    await recordAudit(tx, ctx, {
      action: `incident.${transition}`,
      entityType: "Incident",
      entityId: id,
      before: { status: before.status, resolution: before.resolution, resolvedAt: before.resolvedAt },
      after: { status: after.status, resolution: after.resolution, resolvedAt: after.resolvedAt },
    });
    return after;
  });
}
