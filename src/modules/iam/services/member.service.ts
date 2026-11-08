import { prisma } from "@/lib/db";
import { ForbiddenError, InvalidStateError, NotFoundError } from "@/lib/errors";
import { recordAudit } from "@/modules/audit/audit.service";
import { tenantDb } from "@/modules/tenancy/tenant-db";
import { isRoleKey, type RoleKey } from "../permissions";
import { assertCanAssignRole, assertPermission, assignableRoleKeys, type ActorContext } from "../rbac";
import { getSystemRole } from "./roles";

export async function listMembers(ctx: ActorContext) {
  assertPermission(ctx, "iam.members.read");
  return tenantDb(ctx.organizationId).membership.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, status: true, lastLoginAt: true } },
      role: true,
      department: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

async function loadTargetMembership(ctx: ActorContext, membershipId: string) {
  const db = tenantDb(ctx.organizationId);
  const target = await db.membership.findUnique({ where: { id: membershipId }, include: { role: true } });
  if (!target) throw new NotFoundError();
  if (target.userId === ctx.userId) throw new ForbiddenError("members.cannotModifySelf");
  if (!isRoleKey(target.role.key) || !assignableRoleKeys(ctx).includes(target.role.key)) {
    throw new ForbiddenError("errors.roleNotAssignable");
  }
  return { db, target };
}

async function assertNotLastAdmin(ctx: ActorContext, target: { roleId: string; role: { key: string } }) {
  const adminKey = ctx.isPlatform ? "SUPER_ADMIN" : "COMPANY_ADMIN";
  if (target.role.key !== adminKey) return;
  const admins = await tenantDb(ctx.organizationId).membership.count({
    where: { roleId: target.roleId, status: "ACTIVE" },
  });
  if (admins <= 1) throw new InvalidStateError("members.lastAdmin");
}

export async function changeMemberRole(ctx: ActorContext, membershipId: string, roleKey: RoleKey) {
  assertPermission(ctx, "iam.members.update");
  assertCanAssignRole(ctx, roleKey);
  const { db, target } = await loadTargetMembership(ctx, membershipId);
  if (target.role.key === roleKey) return target;
  await assertNotLastAdmin(ctx, target);
  const role = await getSystemRole(prisma, roleKey);
  const updated = await db.membership.update({ where: { id: membershipId }, data: { roleId: role.id } });
  await recordAudit(db, ctx, {
    action: "membership.role_changed",
    entityType: "Membership",
    entityId: membershipId,
    before: { roleKey: target.role.key },
    after: { roleKey },
  });
  return updated;
}

export async function setMemberStatus(ctx: ActorContext, membershipId: string, status: "ACTIVE" | "SUSPENDED") {
  assertPermission(ctx, "iam.members.suspend");
  const { db, target } = await loadTargetMembership(ctx, membershipId);
  if (target.status === status) return target;
  if (status === "SUSPENDED") await assertNotLastAdmin(ctx, target);
  const updated = await db.membership.update({ where: { id: membershipId }, data: { status } });
  await recordAudit(db, ctx, {
    action: status === "SUSPENDED" ? "membership.suspended" : "membership.reactivated",
    entityType: "Membership",
    entityId: membershipId,
    before: { status: target.status },
    after: { status },
  });
  return updated;
}

export async function listRolesWithPermissions(ctx: ActorContext) {
  assertPermission(ctx, "iam.roles.read");
  return prisma.role.findMany({
    where: { organizationId: null, scope: ctx.isPlatform ? "PLATFORM" : "ORGANIZATION" },
    include: { permissions: { include: { permission: true } } },
    orderBy: { name: "asc" },
  });
}

export async function listUserMemberships(userId: string) {
  return prisma.membership.findMany({
    where: { userId, status: "ACTIVE" },
    include: { organization: { select: { id: true, name: true, status: true, type: true } }, role: true },
    orderBy: { createdAt: "asc" },
  });
}
