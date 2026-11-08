import { describe, expect, it } from "vitest";
import { applyTenantScope, TENANT_SCOPED_MODELS } from "@/modules/tenancy/tenant-scope";

const ORG = "org_a";

describe("applyTenantScope", () => {
  it("exige organizationId", () => {
    expect(() => applyTenantScope("Department", "findMany", {}, "")).toThrow();
  });

  it("injecta o filtro de tenant em leituras", () => {
    expect(applyTenantScope("Department", "findMany", { where: { name: "Ops" } }, ORG)).toEqual({
      where: { name: "Ops", organizationId: ORG },
    });
    expect(applyTenantScope("Department", "findMany", undefined, ORG)).toEqual({ where: { organizationId: ORG } });
  });

  it("sobrepõe um organizationId falsificado no where", () => {
    const out = applyTenantScope("Membership", "findFirst", { where: { organizationId: "org_b" } }, ORG);
    expect(out.where).toEqual({ organizationId: ORG });
  });

  it("força o tenant em create e ignora o valor enviado", () => {
    const out = applyTenantScope("Department", "create", { data: { name: "X", organizationId: "org_b" } }, ORG);
    expect(out.data).toEqual({ name: "X", organizationId: ORG });
  });

  it("força o tenant em createMany", () => {
    const out = applyTenantScope(
      "CostCenter",
      "createMany",
      { data: [{ code: "1", organizationId: "org_b" }, { code: "2" }] },
      ORG,
    );
    expect(out.data).toEqual([
      { code: "1", organizationId: ORG },
      { code: "2", organizationId: ORG },
    ]);
  });

  it("impede mover registos para outra org em update", () => {
    const out = applyTenantScope(
      "Department",
      "update",
      { where: { id: "d1" }, data: { name: "Y", organizationId: "org_b" } },
      ORG,
    );
    expect(out).toEqual({ where: { id: "d1", organizationId: ORG }, data: { name: "Y" } });
  });

  it("filtra delete e deleteMany", () => {
    expect(applyTenantScope("Department", "deleteMany", {}, ORG)).toEqual({ where: { organizationId: ORG } });
    expect(applyTenantScope("Department", "delete", { where: { id: "d1" } }, ORG).where).toEqual({
      id: "d1",
      organizationId: ORG,
    });
  });

  it("upsert: where filtrado, create com tenant, update sem tenant", () => {
    const out = applyTenantScope(
      "Department",
      "upsert",
      { where: { id: "d1" }, create: { name: "A", organizationId: "org_b" }, update: { organizationId: "org_b" } },
      ORG,
    );
    expect(out).toEqual({
      where: { id: "d1", organizationId: ORG },
      create: { name: "A", organizationId: ORG },
      update: {},
    });
  });

  it("Organization: limita à própria org e proíbe criação", () => {
    expect(applyTenantScope("Organization", "findMany", {}, ORG).where).toEqual({ id: ORG });
    expect(applyTenantScope("Organization", "findUnique", { where: { id: "org_b" } }, ORG).where).toEqual({
      id: ORG,
      AND: [{ id: "org_b" }],
    });
    expect(() => applyTenantScope("Organization", "create", { data: {} }, ORG)).toThrow();
  });

  it("não altera modelos globais", () => {
    expect(applyTenantScope("Permission", "findMany", { where: { key: "x" } }, ORG)).toEqual({ where: { key: "x" } });
  });

  it("cobre todas as entidades empresariais das Fases 1 e 2", () => {
    for (const m of [
      "Membership",
      "UserInvite",
      "Department",
      "CostCenter",
      "AuditLog",
      "Notification",
      "Shipment",
      "Document",
      "Quotation",
      "TrackingEvent",
      "Incident",
      "Partner",
    ]) {
      expect(TENANT_SCOPED_MODELS.has(m)).toBe(true);
    }
  });
});
