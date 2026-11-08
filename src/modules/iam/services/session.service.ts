import { prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { recordAccess } from "./access-log.service";

export const SESSION_TTL_HOURS = 12;
const TOUCH_INTERVAL_MS = 5 * 60_000;

export async function createSession(input: {
  userId: string;
  activeOrganizationId: string | null;
  ip?: string;
  userAgent?: string;
}) {
  return prisma.session.create({
    data: {
      userId: input.userId,
      activeOrganizationId: input.activeOrganizationId,
      ipAddress: input.ip,
      userAgent: input.userAgent,
      expiresAt: new Date(Date.now() + SESSION_TTL_HOURS * 3_600_000),
    },
  });
}

/** Sessão válida = existe, não revogada, não expirada e utilizador activo. */
export async function validateSession(sessionId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { user: true } });
  const now = new Date();
  if (!session || session.revokedAt || session.expiresAt <= now) return null;
  if (session.user.status !== "ACTIVE") return null;
  if (session.user.lockedUntil && session.user.lockedUntil > now) return null;
  if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
  }
  return session;
}

export function listActiveSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
  });
}

export async function revokeSession(userId: string, sessionId: string, meta: { ip?: string; userAgent?: string } = {}) {
  const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { user: true } });
  if (!session) throw new NotFoundError();
  if (session.userId !== userId) throw new ForbiddenError();
  if (!session.revokedAt) {
    await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    await recordAccess({ userId, email: session.user.email, event: "SESSION_REVOKED", success: true, ...meta });
  }
}

export async function revokeAllUserSessions(userId: string, exceptSessionId?: string) {
  const res = await prisma.session.updateMany({
    where: { userId, revokedAt: null, id: exceptSessionId ? { not: exceptSessionId } : undefined },
    data: { revokedAt: new Date() },
  });
  return res.count;
}

export async function switchActiveOrganization(sessionId: string, userId: string, organizationId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!membership || membership.status !== "ACTIVE") throw new ForbiddenError();
  await prisma.session.update({ where: { id: sessionId }, data: { activeOrganizationId: organizationId } });
}
