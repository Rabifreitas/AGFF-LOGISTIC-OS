import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/errors";
import {
  ORGANIZATION_ROLE_KEYS,
  PERMISSIONS,
  PLATFORM_ROLE_KEYS,
  ROLE_DEFINITIONS,
  ROLE_KEYS,
  type Permission,
  type RoleKey,
} from "@/modules/iam/permissions";
import {
  assertCanAssignRole,
  assertPermission,
  assignableRoleKeys,
  hasPermission,
  roleHasPermission,
} from "@/modules/iam/rbac";

const holder = (role: RoleKey, isPlatform = ROLE_DEFINITIONS[role].scope === "PLATFORM") => ({
  permissions: new Set<Permission>(ROLE_DEFINITIONS[role].permissions),
  isPlatform,
});

describe("catálogo RBAC", () => {
  it("define exactamente os 11 perfis da especificação", () => {
    expect(ROLE_KEYS).toHaveLength(11);
    expect(
      Object.values(ROLE_DEFINITIONS)
        .map((r) => r.name)
        .sort(),
    ).toEqual(
      [
        "Super Administrator",
        "Platform Operations",
        "Company Administrator",
        "Logistics Manager",
        "Procurement Officer",
        "Document Controller",
        "Finance Officer",
        "Transporter Administrator",
        "Driver",
        "Customer",
        "Auditor",
      ].sort(),
    );
  });

  it("separa perfis de plataforma e de empresa", () => {
    expect(PLATFORM_ROLE_KEYS.sort()).toEqual(["PLATFORM_OPERATIONS", "SUPER_ADMIN"]);
    expect(ORGANIZATION_ROLE_KEYS).toHaveLength(9);
  });

  it("só usa permissões existentes no catálogo", () => {
    const known = new Set(Object.keys(PERMISSIONS));
    for (const role of Object.values(ROLE_DEFINITIONS))
      for (const p of role.permissions) expect(known.has(p)).toBe(true);
  });

  it("perfis de empresa nunca recebem permissões de plataforma", () => {
    for (const key of ORGANIZATION_ROLE_KEYS) {
      expect(ROLE_DEFINITIONS[key].permissions.some((p) => p.startsWith("platform."))).toBe(false);
    }
  });
});

describe("verificação de permissões", () => {
  it("Company Administrator gere a equipa; Driver não", () => {
    expect(roleHasPermission("COMPANY_ADMIN", "iam.members.invite")).toBe(true);
    expect(roleHasPermission("DRIVER", "iam.members.invite")).toBe(false);
    expect(roleHasPermission("DRIVER", "incidents.read")).toBe(true);
    expect(() => assertPermission(holder("DRIVER"), "iam.members.invite")).toThrow(ForbiddenError);
  });

  it("Auditor lê auditoria mas não altera a empresa", () => {
    const auditor = holder("AUDITOR");
    expect(hasPermission(auditor, "audit.read")).toBe(true);
    expect(hasPermission(auditor, "org.profile.update")).toBe(false);
  });

  it("um contexto sem permissões (org suspensa) é sempre negado", () => {
    expect(hasPermission({ permissions: new Set() }, "org.profile.read")).toBe(false);
  });
});

describe("anti-escalada de privilégios", () => {
  it("Company Administrator pode atribuir todos os perfis de empresa, nenhum de plataforma", () => {
    const admin = holder("COMPANY_ADMIN");
    expect(assignableRoleKeys(admin).sort()).toEqual([...ORGANIZATION_ROLE_KEYS].sort());
    expect(() => assertCanAssignRole(admin, "SUPER_ADMIN")).toThrow(ForbiddenError);
  });

  it("Logistics Manager não pode atribuir Company Administrator", () => {
    expect(() => assertCanAssignRole(holder("LOGISTICS_MANAGER"), "COMPANY_ADMIN")).toThrow(ForbiddenError);
  });

  it("Super Administrator só atribui perfis de plataforma na org da plataforma", () => {
    const sa = holder("SUPER_ADMIN");
    expect(assignableRoleKeys(sa).sort()).toEqual(["PLATFORM_OPERATIONS", "SUPER_ADMIN"]);
    expect(() => assertCanAssignRole(sa, "DRIVER")).toThrow(ForbiddenError);
  });
});
