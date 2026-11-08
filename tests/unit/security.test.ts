import { describe, expect, it } from "vitest";
import { hashToken, generateToken } from "@/lib/crypto";
import { validatePasswordPolicy } from "@/lib/password";
import { tenantObjectKey } from "@/lib/storage";
import { sanitizeForAudit } from "@/modules/audit/audit.service";
import { isTemporarilyLocked, LOCKOUT_POLICY, nextLockStateAfterFailure } from "@/modules/iam/lockout";
import { registerSchema } from "@/modules/iam/schemas";

describe("bloqueio de conta", () => {
  const now = new Date("2026-01-01T10:00:00Z");
  it("bloqueia após 5 falhas durante 15 minutos", () => {
    let attempts = 0;
    for (let i = 1; i < LOCKOUT_POLICY.maxFailedAttempts; i++) {
      const s = nextLockStateAfterFailure(attempts, now);
      expect(s.justLocked).toBe(false);
      attempts = s.failedLoginAttempts;
    }
    const locked = nextLockStateAfterFailure(attempts, now);
    expect(locked.justLocked).toBe(true);
    expect(locked.lockedUntil?.getTime()).toBe(now.getTime() + 15 * 60_000);
    expect(isTemporarilyLocked(locked.lockedUntil, new Date(now.getTime() + 14 * 60_000))).toBe(true);
    expect(isTemporarilyLocked(locked.lockedUntil, new Date(now.getTime() + 16 * 60_000))).toBe(false);
  });
});

describe("política de password", () => {
  it("exige 10 caracteres, minúscula, maiúscula e dígito", () => {
    expect(validatePasswordPolicy("short").sort()).toEqual(["digit", "minLength", "uppercase"].sort());
    expect(validatePasswordPolicy("Sup3rSecret!pw")).toEqual([]);
  });
});

describe("tokens", () => {
  it("guarda apenas o hash do token", () => {
    const token = generateToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).toBe(hashToken(token));
  });
});

describe("auditoria", () => {
  it("remove campos sensíveis", () => {
    expect(sanitizeForAudit({ email: "a@b.c", passwordHash: "x", nested: { tokenHash: "y", ok: 1 } })).toEqual({
      email: "a@b.c",
      nested: { ok: 1 },
    });
  });
});

describe("armazenamento", () => {
  it("prefixa as chaves de objectos com a organização", () => {
    expect(tenantObjectKey("org1", "docs", "../evil name.pdf")).toBe("org/org1/docs/.._evil_name.pdf");
    expect(() => tenantObjectKey("", "x")).toThrow();
  });
});

describe("registo", () => {
  it("normaliza NIF e email e exige termos", () => {
    const base = {
      companyName: "Acme",
      legalName: "Acme Lda",
      nif: " 5417abc123 ",
      organizationType: "SHIPPER",
      companyEmail: "GERAL@ACME.AO",
      adminName: "Ana",
      adminEmail: "Ana@Acme.ao",
      password: "Sup3rSecret!pw",
      acceptTerms: true,
    };
    const parsed = registerSchema.parse(base);
    expect(parsed.nif).toBe("5417ABC123");
    expect(parsed.adminEmail).toBe("ana@acme.ao");
    expect(parsed.country).toBe("AO");
    expect(registerSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
  });
});
