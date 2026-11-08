import bcrypt from "bcryptjs";

const ROUNDS = process.env.NODE_ENV === "test" ? 4 : 12;

export const PASSWORD_MIN_LENGTH = 10;

/** Política: ≥10 caracteres, com minúscula, maiúscula e dígito. */
export function validatePasswordPolicy(password: string): string[] {
  const issues: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) issues.push("minLength");
  if (!/[a-z]/.test(password)) issues.push("lowercase");
  if (!/[A-Z]/.test(password)) issues.push("uppercase");
  if (!/[0-9]/.test(password)) issues.push("digit");
  return issues;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
