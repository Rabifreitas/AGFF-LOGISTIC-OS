import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { defaultOrganizationId } from "../context-loader";
import { isTemporarilyLocked, nextLockStateAfterFailure } from "../lockout";
import { recordAccess } from "./access-log.service";
import { createSession } from "./session.service";

export type LoginFailureCode =
  "invalid_credentials" | "account_locked" | "account_disabled" | "temporarily_locked" | "no_active_membership";

export type AuthenticateResult =
  | { ok: true; user: { id: string; email: string; name: string }; sessionId: string; organizationId: string }
  | { ok: false; code: LoginFailureCode };

let dummyHash: Promise<string> | null = null;

export async function authenticate(
  rawEmail: string,
  password: string,
  meta: { ip?: string; userAgent?: string } = {},
): Promise<AuthenticateResult> {
  const email = rawEmail.trim().toLowerCase();
  const now = new Date();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Igualar o tempo de resposta para não revelar se o email existe.
    dummyHash ??= hashPassword("dummy-password-for-timing");
    await verifyPassword(password, await dummyHash);
    await recordAccess({ email, event: "LOGIN_FAILED", success: false, reason: "unknown_user", ...meta });
    return { ok: false, code: "invalid_credentials" };
  }

  const fail = async (code: LoginFailureCode) => {
    await recordAccess({ userId: user.id, email, event: "LOGIN_FAILED", success: false, reason: code, ...meta });
    return { ok: false as const, code };
  };

  if (user.status === "LOCKED") return fail("account_locked");
  if (user.status === "DISABLED") return fail("account_disabled");
  if (isTemporarilyLocked(user.lockedUntil, now)) return fail("temporarily_locked");

  if (!(await verifyPassword(password, user.passwordHash))) {
    // Incremento atómico: tentativas concorrentes não podem sobrescrever o contador.
    const { failedLoginAttempts } = await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    const next = nextLockStateAfterFailure(failedLoginAttempts - 1, now);
    if (next.justLocked) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: next.lockedUntil },
      });
    }
    if (next.justLocked) {
      await recordAccess({
        userId: user.id,
        email,
        event: "ACCOUNT_LOCKED",
        success: false,
        reason: "too_many_attempts",
        ...meta,
      });
      return fail("temporarily_locked");
    }
    return fail("invalid_credentials");
  }

  const organizationId = await defaultOrganizationId(user.id);
  if (!organizationId) return fail("no_active_membership");

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now },
  });
  const session = await createSession({ userId: user.id, activeOrganizationId: organizationId, ...meta });
  await recordAccess({ userId: user.id, email, event: "LOGIN_SUCCESS", success: true, ...meta });

  return { ok: true, user: { id: user.id, email: user.email, name: user.name }, sessionId: session.id, organizationId };
}

export async function logout(sessionId: string, meta: { ip?: string; userAgent?: string } = {}) {
  const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { user: true } });
  if (!session || session.revokedAt) return;
  await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  await recordAccess({ userId: session.userId, email: session.user.email, event: "LOGOUT", success: true, ...meta });
}
