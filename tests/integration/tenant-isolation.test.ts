import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { listOrganizationAudit } from "@/modules/audit/audit.service";
import { listInvites, createInvite } from "@/modules/iam/services/invite.service";
import { changeMemberRole, listMembers } from "@/modules/iam/services/member.service";
import {
  createCostCenter,
  createDepartment,
  deleteDepartment,
  getOrganizationProfile,
  listDepartments,
} from "@/modules/org/services/org.service";
import { tenantDb } from "@/modules/tenancy/tenant-db";
import { createActiveCompany, resetDatabase } from "./helpers";

let A: Awaited<ReturnType<typeof createActiveCompany>>;
let B: Awaited<ReturnType<typeof createActiveCompany>>;

beforeEach(async () => {
  await resetDatabase();
  A = await createActiveCompany({ companyName: "Empresa A" });
  B = await createActiveCompany({ companyName: "Empresa B" });
  await createDepartment(B.ctx, { name: "Operações B", code: "OPB" });
  await createInvite(B.ctx, { email: "convidado-b@b.test", roleKey: "DRIVER" });
});

describe("isolamento multi-tenant: org A não lê dados da org B", () => {
  it("listagens de serviço só devolvem dados da própria org", async () => {
    expect(await listDepartments(A.ctx)).toHaveLength(0);
    expect(await listInvites(A.ctx)).toHaveLength(0);
    const members = await listMembers(A.ctx);
    expect(members.every((m) => m.organizationId === A.organization.id)).toBe(true);
    const audit = await listOrganizationAudit(A.ctx, { take: 200 });
    expect(audit.length).toBeGreaterThan(0);
    expect(audit.every((r) => r.organizationId === A.organization.id)).toBe(true);
    expect((await getOrganizationProfile(A.ctx)).id).toBe(A.organization.id);
  });

  it("tenantDb(A) não encontra registos de B nem por id", async () => {
    const depB = await prisma.department.findFirstOrThrow({ where: { organizationId: B.organization.id } });
    const dbA = tenantDb(A.organization.id);
    expect(await dbA.department.findUnique({ where: { id: depB.id } })).toBeNull();
    expect(await dbA.department.findFirst({ where: { organizationId: B.organization.id } })).toBeNull();
    expect(await dbA.department.count()).toBe(0);
    expect(await dbA.organization.findUnique({ where: { id: B.organization.id } })).toBeNull();
    expect(await dbA.userInvite.findMany()).toHaveLength(0);
  });

  it("A não consegue alterar nem apagar dados de B", async () => {
    const depB = await prisma.department.findFirstOrThrow({ where: { organizationId: B.organization.id } });
    await expect(deleteDepartment(A.ctx, depB.id)).rejects.toThrow();
    const res = await tenantDb(A.organization.id).department.updateMany({
      where: { id: depB.id },
      data: { name: "hack" },
    });
    expect(res.count).toBe(0);
    expect((await prisma.department.findUniqueOrThrow({ where: { id: depB.id } })).name).toBe("Operações B");

    const memberB = await prisma.membership.findFirstOrThrow({ where: { organizationId: B.organization.id } });
    await expect(changeMemberRole(A.ctx, memberB.id, "DRIVER")).rejects.toThrow();
  });

  it("um organizationId falsificado em create é ignorado", async () => {
    const dep = await tenantDb(A.organization.id).department.create({
      data: { name: "Infiltrado", organizationId: B.organization.id } as never,
    });
    expect(dep.organizationId).toBe(A.organization.id);
  });

  it("A não consegue associar um departamento de B a um centro de custo", async () => {
    const depB = await prisma.department.findFirstOrThrow({ where: { organizationId: B.organization.id } });
    await expect(createCostCenter(A.ctx, { code: "CC1", name: "Centro", departmentId: depB.id })).rejects.toThrow();
  });
});
