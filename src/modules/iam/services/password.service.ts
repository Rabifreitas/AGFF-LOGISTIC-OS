import { prisma } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/crypto";
import { AppError, InvalidStateError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/password";
import { recordAudit } from "@/modules/audit/audit.service";
import { recordAccess } from "./access-log.service";
import { revokeAllUserSessions } from "./session.service";

export const RESET_TOKEN_TTL_MINUTES = 60;

/** Devolve o token em claro (para envio por email) ou null se o email não existir. */
export async function requestPasswordReset(rawEmail: string, meta: { ip?: string; userAgent?: string } = {}) {
  const email = rawEmail.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status === "DISABLED") return null;
  const token = generateToken();
  await prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000) },
  });
  await recordAccess({ userId: user.id, email, event: "PASSWORD_RESET_REQUESTED", success: true, ...meta });
  return { token, user: { id: user.id, email: user.email, name: user.name, locale: user.locale } };
}

export async function findValidResetToken(token: string) {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt <= new Date()) return null;
  return record;
}

export async function resetPassword(token: string, newPassword: string, meta: { ip?: string; userAgent?: string } = {}) {
  const record = await findValidResetToken(token);
  if (!record) throw new InvalidStateError("reset.invalidToken");
  const passwordHash = await hashPassword(newPassword);
  const user = await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    const u = await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, passwordChangedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });
    await recordAudit(tx, { userId: u.id, organizationId: null, ...meta }, { action: "user.password_reset", entityType: "User", entityId: u.id });
    return u;
  });
  await revokeAllUserSessions(user.id);
  await recordAccess({ userId: user.id, email: user.email, event: "PASSWORD_RESET", success: true, ...meta });
}

export async function changePassword(
  userId: string,
  currentSessionId: string | undefined,
  currentPassword: string,
  newPassword: string,
  meta: { ip?: string; userAgent?: string } = {},
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AppError("VALIDATION", "account.wrongPassword");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date() },
  });
  await recordAudit(prisma, { userId, organizationId: null, ...meta }, { action: "user.password_changed", entityType: "User", entityId: userId });
  await revokeAllUserSessions(userId, currentSessionId);
  await recordAccess({ userId, email: user.email, event: "PASSWORD_CHANGED", success: true, ...meta });
}
