export const LOCKOUT_POLICY = { maxFailedAttempts: 5, lockMinutes: 15 } as const;

export type LockState = { failedLoginAttempts: number; lockedUntil: Date | null; justLocked: boolean };

/** Calcula o novo estado após uma tentativa de login falhada. */
export function nextLockStateAfterFailure(
  previousFailedAttempts: number,
  now: Date,
  policy: { maxFailedAttempts: number; lockMinutes: number } = LOCKOUT_POLICY,
): LockState {
  const attempts = previousFailedAttempts + 1;
  if (attempts >= policy.maxFailedAttempts) {
    return {
      failedLoginAttempts: 0,
      lockedUntil: new Date(now.getTime() + policy.lockMinutes * 60_000),
      justLocked: true,
    };
  }
  return { failedLoginAttempts: attempts, lockedUntil: null, justLocked: false };
}

export function isTemporarilyLocked(lockedUntil: Date | null | undefined, now: Date): boolean {
  return !!lockedUntil && lockedUntil.getTime() > now.getTime();
}
