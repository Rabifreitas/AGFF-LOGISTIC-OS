import { prisma } from "@/lib/db";

export type AccessEvent =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "ACCOUNT_LOCKED"
  | "LOGOUT"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET"
  | "PASSWORD_CHANGED"
  | "SESSION_REVOKED";

export async function recordAccess(entry: {
  userId?: string | null;
  email: string;
  event: AccessEvent;
  success: boolean;
  reason?: string;
  ip?: string;
  userAgent?: string;
}) {
  await prisma.accessLog.create({
    data: {
      userId: entry.userId ?? null,
      email: entry.email,
      event: entry.event,
      success: entry.success,
      reason: entry.reason,
      ipAddress: entry.ip,
      userAgent: entry.userAgent,
    },
  });
}

export function listUserAccessLog(userId: string, take = 50) {
  return prisma.accessLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });
}
