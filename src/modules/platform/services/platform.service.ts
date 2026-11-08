import type { OrganizationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ForbiddenError, InvalidStateError, NotFoundError } from "@/lib/errors";
import { recordAudit } from "@/modules/audit/audit.service";
import { assertPermission, type ActorContext } from "@/modules/iam/rbac";
import { recordAccess } from "@/modules/iam/services/access-log.service";
import { revokeAllUserSessions } from "@/modules/iam/services/session.service";
import { notifyUsers, usersWithPermission } from "@/modules/notifications/notification.service";
import { nextStatus, type OrganizationTransition } from "@/modules/org/status";

const TRANSITION_PERMISSION = {
  approve: "platform.organizations.approve",
  reject: "platform.organizations.approve",
  suspend: "platform.organizations.suspend",
  reactivate: "platform.organizations.suspend",
} as const;

export async function listOrganizations(ctx: ActorContext, filter: { status?: OrganizationStatus; q?: string } = {}) {
  assertPermission(ctx, "platform.organizations.read");
  const where: Prisma.OrganizationWhereInput = {
    type: { not: "PLATFORM" },
    status: filter.status,
    OR: filter.q
      ? [
          { name: { contains: filter.q, mode: "insensitive" } },
          { nif: { contains: filter.q, mode: "insensitive" } },
          { email: { contains: filter.q, mode: "insensitive" } },
        ]
      : undefined,
  };
  return prisma.organization.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { memberships: true } } },
    take: 200,
  });
}

export async function getOrganizationForAdmin(ctx: ActorContext, organizationId: string) {
  assertPermission(ctx, "platform.organizations.read");
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      addresses: true,
      contacts: true,
      representatives: true,
      memberships: { include: { user: { select: { id: true, name: true, email: true, status: true } }, role: true } },
    },
  });
  if (!org) throw new NotFoundError();
  return org;
}

export async function transitionOrganization(
  ctx: ActorContext,
  organizationId: string,
  transition: OrganizationTransition,
  reason?: string,
) {
  assertPermission(ctx, TRANSITION_PERMISSION[transition]);
  const before = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!before) throw new NotFoundError();
  if (before.type === "PLATFORM") throw new ForbiddenError();
  const to = nextStatus(before.status, transition);
  if (!to) throw new InvalidStateError("admin.invalidTransition");
  if ((transition === "reject" || transition === "suspend") && !reason?.trim()) {
    throw new InvalidStateError("admin.reasonRequired");
  }

  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.organization.update({
      where: { id: organizationId },
      data: {
        status: to,
        statusReason: reason?.trim() || null,
        ...(transition === "approve" ? { approvedAt: new Date(), approvedById: ctx.userId } : {}),
      },
    });
    await recordAudit(tx, ctx, {
      organizationId,
      action: `organization.${transition}`,
      entityType: "Organization",
      entityId: organizationId,
      before: { status: before.status, statusReason: before.statusReason },
      after: { status: updated.status, statusReason: updated.statusReason },
    });
    return updated;
  });

  const admins = await prisma.membership.findMany({
    where: { organizationId, role: { key: "COMPANY_ADMIN" } },
    select: { userId: true, user: { select: { email: true, name: true, locale: true } } },
  });
  await notifyUsers(prisma, organizationId, admins.map((a) => a.userId), {
    type: `organization.${to.toLowerCase()}`,
    title: `organization.status.${to}`,
    body: reason,
    link: "/app",
  });
  return { organization: after, notifiedAdmins: admins.map((a) => a.user) };
}

export async function pendingApprovalCount(ctx: ActorContext) {
  assertPermission(ctx, "platform.organizations.read");
  return prisma.organization.count({ where: { status: "PENDING_APPROVAL" } });
}

export async function listUsers(ctx: ActorContext, q?: string) {
  assertPermission(ctx, "platform.users.read");
  return prisma.user.findMany({
    where: q
      ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] }
      : undefined,
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      lockedUntil: true,
      lastLoginAt: true,
      createdAt: true,
      memberships: { select: { organization: { select: { name: true } }, role: { select: { key: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function setUserLock(ctx: ActorContext, userId: string, locked: boolean, reason?: string) {
  assertPermission(ctx, "platform.users.lock");
  if (userId === ctx.userId) throw new ForbiddenError("members.cannotModifySelf");
  const before = await prisma.user.findUnique({ where: { id: userId } });
  if (!before) throw new NotFoundError();
  const after = await prisma.user.update({
    where: { id: userId },
    data: locked
      ? { status: "LOCKED", lockReason: reason?.trim() || null }
      : { status: "ACTIVE", lockReason: null, lockedUntil: null, failedLoginAttempts: 0 },
  });
  if (locked) await revokeAllUserSessions(userId);
  await recordAudit(prisma, ctx, {
    organizationId: null,
    action: locked ? "user.locked" : "user.unlocked",
    entityType: "User",
    entityId: userId,
    before: { status: before.status },
    after: { status: after.status, lockReason: after.lockReason },
  });
  if (locked) {
    await recordAccess({ userId, email: after.email, event: "ACCOUNT_LOCKED", success: true, reason: "admin", ip: ctx.ip, userAgent: ctx.userAgent });
  }
  return after;
}

export { usersWithPermission };
