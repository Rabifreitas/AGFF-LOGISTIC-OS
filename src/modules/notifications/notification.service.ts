import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ActorContext } from "@/modules/iam/rbac";
import { tenantDb } from "@/modules/tenancy/tenant-db";

type NotificationWriter = {
  notification: { createMany: (args: { data: Prisma.NotificationCreateManyInput[] }) => Promise<unknown> };
};

export type NewNotification = {
  type: string;
  title: string;
  body?: string;
  link?: string;
  data?: Prisma.InputJsonValue;
};

export async function notifyUsers(
  db: NotificationWriter,
  organizationId: string,
  userIds: string[],
  n: NewNotification,
) {
  if (userIds.length === 0) return;
  await db.notification.createMany({
    data: userIds.map((userId) => ({ organizationId, userId, ...n })),
  });
}

/** Utilizadores activos de uma organização cujo perfil tem a permissão indicada. */
export async function usersWithPermission(organizationId: string, permissionKey: string) {
  const members = await prisma.membership.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      user: { status: "ACTIVE" },
      role: { permissions: { some: { permission: { key: permissionKey } } } },
    },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

export async function listMyNotifications(ctx: ActorContext, take = 50) {
  return tenantDb(ctx.organizationId).notification.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function countUnread(ctx: ActorContext) {
  return tenantDb(ctx.organizationId).notification.count({ where: { userId: ctx.userId, readAt: null } });
}

export async function markNotificationsRead(ctx: ActorContext, ids?: string[]) {
  await tenantDb(ctx.organizationId).notification.updateMany({
    where: { userId: ctx.userId, readAt: null, id: ids ? { in: ids } : undefined },
    data: { readAt: new Date() },
  });
}
