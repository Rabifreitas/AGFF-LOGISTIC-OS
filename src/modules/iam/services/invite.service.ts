import { prisma } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/crypto";
import { ConflictError, ForbiddenError, InvalidStateError, NotFoundError } from "@/lib/errors";
import { hashPassword } from "@/lib/password";
import { recordAudit } from "@/modules/audit/audit.service";
import { notifyUsers } from "@/modules/notifications/notification.service";
import { tenantDb } from "@/modules/tenancy/tenant-db";
import type { RoleKey } from "../permissions";
import { assertCanAssignRole, assertPermission, type ActorContext } from "../rbac";
import { getSystemRole } from "./roles";

export const INVITE_TTL_DAYS = 7;

export async function createInvite(ctx: ActorContext, input: { email: string; roleKey: RoleKey }) {
  assertPermission(ctx, "iam.members.invite");
  assertCanAssignRole(ctx, input.roleKey);
  const email = input.email.trim().toLowerCase();
  const db = tenantDb(ctx.organizationId);

  const existingMember = await db.membership.findFirst({ where: { user: { email } } });
  if (existingMember) throw new ConflictError("invites.alreadyMember");

  const role = await getSystemRole(prisma, input.roleKey);
  const token = generateToken();

  const invite = await db.$transaction(async (tx) => {
    await tx.userInvite.updateMany({
      where: { email, status: "PENDING" },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    const created = await tx.userInvite.create({
      data: {
        organizationId: ctx.organizationId,
        email,
        roleId: role.id,
        tokenHash: hashToken(token),
        invitedById: ctx.userId,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
      },
    });
    await recordAudit(tx, ctx, {
      action: "invite.created",
      entityType: "UserInvite",
      entityId: created.id,
      after: { ...created, roleKey: role.key },
    });
    return created;
  });

  return { invite, token, role };
}

export async function listInvites(ctx: ActorContext) {
  assertPermission(ctx, "iam.members.read");
  return tenantDb(ctx.organizationId).userInvite.findMany({
    where: { status: "PENDING" },
    include: { role: true, invitedBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeInvite(ctx: ActorContext, inviteId: string) {
  assertPermission(ctx, "iam.members.invite");
  const db = tenantDb(ctx.organizationId);
  const invite = await db.userInvite.findUnique({ where: { id: inviteId } });
  if (!invite) throw new NotFoundError();
  if (invite.status !== "PENDING") throw new InvalidStateError();
  const updated = await db.userInvite.update({
    where: { id: inviteId },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  await recordAudit(db, ctx, {
    action: "invite.revoked",
    entityType: "UserInvite",
    entityId: inviteId,
    before: invite,
    after: updated,
  });
}

/** Pesquisa pública por token (página de aceitação). */
export async function getInviteByToken(token: string) {
  const invite = await prisma.userInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { organization: true, role: true },
  });
  if (!invite || invite.status !== "PENDING") return null;
  if (invite.expiresAt <= new Date()) {
    await prisma.userInvite.update({ where: { id: invite.id }, data: { status: "EXPIRED" } });
    return null;
  }
  const existingUser = await prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } });
  return { ...invite, userExists: !!existingUser };
}

async function finalizeAcceptance(
  inviteId: string,
  organizationId: string,
  roleId: string,
  invitedById: string,
  userId: string,
  meta: { ip?: string; userAgent?: string },
) {
  const membership = await prisma.$transaction(async (tx) => {
    const existing = await tx.membership.findUnique({ where: { userId_organizationId: { userId, organizationId } } });
    if (existing) throw new ConflictError("invites.alreadyMember");
    const m = await tx.membership.create({ data: { userId, organizationId, roleId } });
    await tx.userInvite.update({ where: { id: inviteId }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
    const actor = { userId, organizationId, ...meta };
    await recordAudit(tx, actor, { action: "invite.accepted", entityType: "UserInvite", entityId: inviteId });
    await recordAudit(tx, actor, { action: "membership.created", entityType: "Membership", entityId: m.id, after: m });
    return m;
  });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await notifyUsers(prisma, organizationId, [invitedById], {
    type: "invite.accepted",
    title: `${user.name} aceitou o convite`,
    body: user.email,
    link: "/app/team",
  });
  return membership;
}

async function loadPendingInvite(token: string) {
  const invite = await getInviteByToken(token);
  if (!invite) throw new InvalidStateError("invites.invalid");
  if (invite.organization.status !== "ACTIVE") throw new InvalidStateError("invites.organizationInactive");
  return invite;
}

export async function acceptInviteAsNewUser(
  token: string,
  input: { name: string; password: string },
  meta: { ip?: string; userAgent?: string } = {},
) {
  const invite = await loadPendingInvite(token);
  if (invite.userExists) throw new ConflictError("invites.loginToAccept");
  const user = await prisma.user.create({
    data: {
      email: invite.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      passwordChangedAt: new Date(),
    },
  });
  await recordAudit(
    prisma,
    { userId: user.id, organizationId: invite.organizationId, ...meta },
    {
      action: "user.created",
      entityType: "User",
      entityId: user.id,
      after: { id: user.id, email: user.email, name: user.name },
    },
  );
  const membership = await finalizeAcceptance(
    invite.id,
    invite.organizationId,
    invite.roleId,
    invite.invitedById,
    user.id,
    meta,
  );
  return { user, membership };
}

export async function acceptInviteAsExistingUser(
  token: string,
  userId: string,
  meta: { ip?: string; userAgent?: string } = {},
) {
  const invite = await loadPendingInvite(token);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.email !== invite.email) throw new ForbiddenError("invites.emailMismatch");
  const membership = await finalizeAcceptance(
    invite.id,
    invite.organizationId,
    invite.roleId,
    invite.invitedById,
    user.id,
    meta,
  );
  return { user, membership };
}
