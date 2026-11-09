import type { PartnerStatus, PartnerType, VerificationStatus } from "@prisma/client";
import { InvalidStateError, NotFoundError } from "@/lib/errors";
import { recordAudit } from "@/modules/audit/audit.service";
import { assertPermission, type ActorContext } from "@/modules/iam/rbac";
import { tenantDb } from "@/modules/tenancy/tenant-db";
import { hasValidVerification, nextPartnerStatus, type PartnerTransition } from "../partner-status";
import type { PartnerInput, VerificationInput } from "../schemas";

export async function listPartners(ctx: ActorContext, filter: { type?: PartnerType; status?: PartnerStatus } = {}) {
  assertPermission(ctx, "mkt.partners.read");
  return tenantDb(ctx.organizationId).partner.findMany({
    where: { ...(filter.type ? { type: filter.type } : {}), ...(filter.status ? { status: filter.status } : {}) },
    orderBy: { name: "asc" },
    take: 500,
  });
}

export async function getPartner(ctx: ActorContext, id: string) {
  assertPermission(ctx, "mkt.partners.read");
  const partner = await tenantDb(ctx.organizationId).partner.findUnique({
    where: { id },
    include: { verifications: { orderBy: { createdAt: "desc" } } },
  });
  if (!partner) throw new NotFoundError();
  return partner;
}

export async function createPartner(ctx: ActorContext, input: PartnerInput) {
  assertPermission(ctx, "mkt.partners.manage");
  const db = tenantDb(ctx.organizationId);
  return db.$transaction(async (tx) => {
    const created = await tx.partner.create({ data: { ...input, organizationId: ctx.organizationId } });
    await recordAudit(tx, ctx, {
      action: "partner.created",
      entityType: "Partner",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

export async function updatePartner(ctx: ActorContext, id: string, input: PartnerInput) {
  assertPermission(ctx, "mkt.partners.manage");
  const db = tenantDb(ctx.organizationId);
  return db.$transaction(async (tx) => {
    const before = await tx.partner.findUnique({ where: { id } });
    if (!before) throw new NotFoundError();
    const after = await tx.partner.update({ where: { id }, data: input });
    await recordAudit(tx, ctx, { action: "partner.updated", entityType: "Partner", entityId: id, before, after });
    return after;
  });
}

export async function transitionPartner(ctx: ActorContext, id: string, transition: PartnerTransition) {
  assertPermission(ctx, "mkt.partners.manage");
  const db = tenantDb(ctx.organizationId);
  return db.$transaction(async (tx) => {
    const before = await tx.partner.findUnique({ where: { id }, include: { verifications: true } });
    if (!before) throw new NotFoundError();
    const to = nextPartnerStatus(before.status, transition);
    if (!to) throw new InvalidStateError("partners.invalidTransition");
    if ((transition === "verify" || transition === "reactivate") && !hasValidVerification(before.verifications)) {
      throw new InvalidStateError("partners.needsApprovedVerification");
    }
    const after = await tx.partner.update({ where: { id }, data: { status: to } });
    await recordAudit(tx, ctx, {
      action: `partner.${transition}`,
      entityType: "Partner",
      entityId: id,
      before: { status: before.status },
      after: { status: after.status },
    });
    return after;
  });
}

export async function addVerification(ctx: ActorContext, partnerId: string, input: VerificationInput) {
  assertPermission(ctx, "mkt.partners.manage");
  const db = tenantDb(ctx.organizationId);
  return db.$transaction(async (tx) => {
    const partner = await tx.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundError();
    const created = await tx.partnerVerification.create({
      data: { ...input, partnerId, organizationId: ctx.organizationId },
    });
    await recordAudit(tx, ctx, {
      action: "partner.verification.created",
      entityType: "PartnerVerification",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

export async function reviewVerification(
  ctx: ActorContext,
  verificationId: string,
  decision: Extract<VerificationStatus, "APPROVED" | "REJECTED">,
  notes?: string | null,
) {
  assertPermission(ctx, "mkt.partners.manage");
  const db = tenantDb(ctx.organizationId);
  return db.$transaction(async (tx) => {
    const before = await tx.partnerVerification.findUnique({ where: { id: verificationId } });
    if (!before) throw new NotFoundError();
    if (before.status !== "PENDING") throw new InvalidStateError("partners.verificationReviewed");
    if (decision === "APPROVED" && before.expiresAt && before.expiresAt < new Date()) {
      throw new InvalidStateError("partners.verificationExpired");
    }
    const after = await tx.partnerVerification.update({
      where: { id: verificationId },
      data: { status: decision, reviewedById: ctx.userId, reviewedAt: new Date(), notes: notes ?? before.notes },
    });
    await recordAudit(tx, ctx, {
      action: `partner.verification.${decision === "APPROVED" ? "approved" : "rejected"}`,
      entityType: "PartnerVerification",
      entityId: verificationId,
      before: { status: before.status },
      after: { status: after.status, reviewedById: after.reviewedById },
    });
    return after;
  });
}
