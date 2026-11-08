import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { listOrganizationAudit, listPlatformAudit } from "@/modules/audit/audit.service";
import { loadActorContext } from "@/modules/iam/context-loader";
import { acceptInviteAsNewUser, createInvite } from "@/modules/iam/services/invite.service";
import { changeMemberRole, setMemberStatus } from "@/modules/iam/services/member.service";
import { addAddress, createDepartment, updateOrganizationProfile } from "@/modules/org/services/org.service";
import { listOrganizations, transitionOrganization } from "@/modules/platform/services/platform.service";
import type { RoleKey } from "@/modules/iam/permissions";
import { createActiveCompany, PASSWORD, resetDatabase } from "./helpers";

let company: Awaited<ReturnType<typeof createActiveCompany>>;

async function memberWithRole(roleKey: RoleKey) {
  const email = `${roleKey.toLowerCase()}@co.test`;
  const { token } = await createInvite(company.ctx, { email, roleKey });
  const { user } = await acceptInviteAsNewUser(token, { name: roleKey, password: PASSWORD });
  return (await loadActorContext(user.id, company.organization.id))!;
}

beforeEach(async () => {
  await resetDatabase();
  company = await createActiveCompany();
});

describe("RBAC no servidor", () => {
  it("Driver não convida, não edita a empresa e não lê auditoria", async () => {
    const driver = await memberWithRole("DRIVER");
    await expect(createInvite(driver, { email: "x@co.test", roleKey: "DRIVER" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(createDepartment(driver, { name: "X", code: null })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listOrganizationAudit(driver)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("Auditor lê auditoria mas não altera dados", async () => {
    const auditor = await memberWithRole("AUDITOR");
    await expect(listOrganizationAudit(auditor)).resolves.toBeDefined();
    await expect(
      addAddress(auditor, {
        type: "HEADQUARTERS",
        line1: "Rua 1",
        line2: null,
        city: "Luanda",
        province: null,
        postalCode: null,
        country: "AO",
        isPrimary: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("Logistics Manager não consegue promover-se nem convidar administradores", async () => {
    const manager = await memberWithRole("LOGISTICS_MANAGER");
    await expect(createInvite(manager, { email: "boss@co.test", roleKey: "COMPANY_ADMIN" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(changeMemberRole(manager, manager.membershipId, "COMPANY_ADMIN")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("Company Administrator não acede a funções de plataforma", async () => {
    await expect(listOrganizations(company.ctx)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(transitionOrganization(company.ctx, company.organization.id, "suspend", "x")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(listPlatformAudit(company.ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("Company Administrator não pode convidar Super Administrator", async () => {
    await expect(createInvite(company.ctx, { email: "sa@co.test", roleKey: "SUPER_ADMIN" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("membro suspenso perde as permissões", async () => {
    const manager = await memberWithRole("LOGISTICS_MANAGER");
    await setMemberStatus(company.ctx, manager.membershipId, "SUSPENDED");
    const ctx = await loadActorContext(manager.userId, company.organization.id);
    expect(ctx?.permissions.size ?? 0).toBe(0);
  });
});

describe("audit log", () => {
  it("regista utilizador, org, acção, entidade e valores anteriores/novos", async () => {
    await updateOrganizationProfile(company.ctx, {
      name: "Nome Novo",
      legalName: company.organization.legalName,
      country: "AO",
      currency: "USD",
      taxRegime: null,
      vatNumber: null,
      commercialRegistry: null,
      email: company.organization.email,
      phone: null,
      website: null,
    });
    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { organizationId: company.organization.id, action: "organization.updated" },
    });
    expect(entry.userId).toBe(company.user.id);
    expect(entry.entityType).toBe("Organization");
    expect(entry.entityId).toBe(company.organization.id);
    expect(entry.createdAt).toBeInstanceOf(Date);
    expect(entry.before).toMatchObject({ name: company.organization.name, currency: "AOA" });
    expect(entry.after).toMatchObject({ name: "Nome Novo", currency: "USD" });
  });

  it("nunca guarda hashes de password ou tokens", async () => {
    const rows = await prisma.auditLog.findMany();
    const dump = JSON.stringify(rows);
    expect(dump).not.toMatch(/passwordHash|tokenHash/);
  });

  it("alterações de perfil ficam auditadas com antes/depois", async () => {
    const driver = await memberWithRole("DRIVER");
    await changeMemberRole(company.ctx, driver.membershipId, "CUSTOMER");
    const entry = await prisma.auditLog.findFirstOrThrow({ where: { action: "membership.role_changed" } });
    expect(entry.before).toEqual({ roleKey: "DRIVER" });
    expect(entry.after).toEqual({ roleKey: "CUSTOMER" });
  });
});
