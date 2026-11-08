import type { z } from "zod";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { recordAudit } from "@/modules/audit/audit.service";
import { assertPermission, type ActorContext } from "@/modules/iam/rbac";
import { tenantDb } from "@/modules/tenancy/tenant-db";
import {
  DEFAULT_ORG_SETTINGS,
  orgSettingsSchema,
  type addressSchema,
  type contactSchema,
  type costCenterSchema,
  type departmentSchema,
  type orgProfileSchema,
  type OrgSettings,
  type representativeSchema,
} from "../schemas";

export async function getOrganizationProfile(ctx: ActorContext) {
  assertPermission(ctx, "org.profile.read");
  const db = tenantDb(ctx.organizationId);
  const organization = await db.organization.findUnique({
    where: { id: ctx.organizationId },
    include: {
      addresses: { orderBy: { createdAt: "asc" } },
      contacts: { orderBy: { createdAt: "asc" } },
      representatives: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!organization) throw new NotFoundError();
  return organization;
}

export async function updateOrganizationProfile(ctx: ActorContext, input: z.infer<typeof orgProfileSchema>) {
  assertPermission(ctx, "org.profile.update");
  const db = tenantDb(ctx.organizationId);
  return db.$transaction(async (tx) => {
    const before = await tx.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } });
    const after = await tx.organization.update({ where: { id: ctx.organizationId }, data: input });
    await recordAudit(tx, ctx, { action: "organization.updated", entityType: "Organization", entityId: after.id, before, after });
    return after;
  });
}

// ── Endereços / contactos / representantes ─────────────────────

export async function addAddress(ctx: ActorContext, input: z.infer<typeof addressSchema>) {
  assertPermission(ctx, "org.profile.update");
  const db = tenantDb(ctx.organizationId);
  return db.$transaction(async (tx) => {
    if (input.isPrimary) await tx.organizationAddress.updateMany({ data: { isPrimary: false } });
    const created = await tx.organizationAddress.create({ data: { ...input, organizationId: ctx.organizationId } });
    await recordAudit(tx, ctx, { action: "organization.address_added", entityType: "OrganizationAddress", entityId: created.id, after: created });
    return created;
  });
}

export async function removeAddress(ctx: ActorContext, id: string) {
  assertPermission(ctx, "org.profile.update");
  const db = tenantDb(ctx.organizationId);
  const before = await db.organizationAddress.findUnique({ where: { id } });
  if (!before) throw new NotFoundError();
  await db.organizationAddress.delete({ where: { id } });
  await recordAudit(db, ctx, { action: "organization.address_removed", entityType: "OrganizationAddress", entityId: id, before });
}

export async function addContact(ctx: ActorContext, input: z.infer<typeof contactSchema>) {
  assertPermission(ctx, "org.profile.update");
  const db = tenantDb(ctx.organizationId);
  const created = await db.organizationContact.create({ data: { ...input, organizationId: ctx.organizationId } });
  await recordAudit(db, ctx, { action: "organization.contact_added", entityType: "OrganizationContact", entityId: created.id, after: created });
  return created;
}

export async function removeContact(ctx: ActorContext, id: string) {
  assertPermission(ctx, "org.profile.update");
  const db = tenantDb(ctx.organizationId);
  const before = await db.organizationContact.findUnique({ where: { id } });
  if (!before) throw new NotFoundError();
  await db.organizationContact.delete({ where: { id } });
  await recordAudit(db, ctx, { action: "organization.contact_removed", entityType: "OrganizationContact", entityId: id, before });
}

export async function addRepresentative(ctx: ActorContext, input: z.infer<typeof representativeSchema>) {
  assertPermission(ctx, "org.profile.update");
  const db = tenantDb(ctx.organizationId);
  const created = await db.organizationRepresentative.create({ data: { ...input, organizationId: ctx.organizationId } });
  await recordAudit(db, ctx, { action: "organization.representative_added", entityType: "OrganizationRepresentative", entityId: created.id, after: created });
  return created;
}

export async function removeRepresentative(ctx: ActorContext, id: string) {
  assertPermission(ctx, "org.profile.update");
  const db = tenantDb(ctx.organizationId);
  const before = await db.organizationRepresentative.findUnique({ where: { id } });
  if (!before) throw new NotFoundError();
  await db.organizationRepresentative.delete({ where: { id } });
  await recordAudit(db, ctx, { action: "organization.representative_removed", entityType: "OrganizationRepresentative", entityId: id, before });
}

// ── Departamentos ──────────────────────────────────────────────

export async function listDepartments(ctx: ActorContext) {
  assertPermission(ctx, "org.profile.read");
  return tenantDb(ctx.organizationId).department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { memberships: true, costCenters: true } } },
  });
}

export async function createDepartment(ctx: ActorContext, input: z.infer<typeof departmentSchema>) {
  assertPermission(ctx, "org.departments.manage");
  const db = tenantDb(ctx.organizationId);
  const created = await db.department.create({ data: { ...input, organizationId: ctx.organizationId } });
  await recordAudit(db, ctx, { action: "department.created", entityType: "Department", entityId: created.id, after: created });
  return created;
}

export async function updateDepartment(ctx: ActorContext, id: string, input: z.infer<typeof departmentSchema>) {
  assertPermission(ctx, "org.departments.manage");
  const db = tenantDb(ctx.organizationId);
  const before = await db.department.findUnique({ where: { id } });
  if (!before) throw new NotFoundError();
  const after = await db.department.update({ where: { id }, data: input });
  await recordAudit(db, ctx, { action: "department.updated", entityType: "Department", entityId: id, before, after });
  return after;
}

export async function deleteDepartment(ctx: ActorContext, id: string) {
  assertPermission(ctx, "org.departments.manage");
  const db = tenantDb(ctx.organizationId);
  const before = await db.department.findUnique({ where: { id } });
  if (!before) throw new NotFoundError();
  await db.department.delete({ where: { id } });
  await recordAudit(db, ctx, { action: "department.deleted", entityType: "Department", entityId: id, before });
}

// ── Centros de custo ───────────────────────────────────────────

export async function listCostCenters(ctx: ActorContext) {
  assertPermission(ctx, "org.cost_centers.read");
  return tenantDb(ctx.organizationId).costCenter.findMany({ orderBy: { code: "asc" }, include: { department: true } });
}

async function assertDepartmentInTenant(ctx: ActorContext, departmentId: string | null) {
  if (!departmentId) return;
  const dep = await tenantDb(ctx.organizationId).department.findUnique({ where: { id: departmentId } });
  if (!dep) throw new NotFoundError();
}

export async function createCostCenter(ctx: ActorContext, input: z.infer<typeof costCenterSchema>) {
  assertPermission(ctx, "org.cost_centers.manage");
  await assertDepartmentInTenant(ctx, input.departmentId);
  const db = tenantDb(ctx.organizationId);
  const created = await db.costCenter.create({ data: { ...input, organizationId: ctx.organizationId } });
  await recordAudit(db, ctx, { action: "cost_center.created", entityType: "CostCenter", entityId: created.id, after: created });
  return created;
}

export async function setCostCenterActive(ctx: ActorContext, id: string, active: boolean) {
  assertPermission(ctx, "org.cost_centers.manage");
  const db = tenantDb(ctx.organizationId);
  const before = await db.costCenter.findUnique({ where: { id } });
  if (!before) throw new NotFoundError();
  const after = await db.costCenter.update({ where: { id }, data: { active } });
  await recordAudit(db, ctx, { action: "cost_center.updated", entityType: "CostCenter", entityId: id, before, after });
  return after;
}

export async function deleteCostCenter(ctx: ActorContext, id: string) {
  assertPermission(ctx, "org.cost_centers.manage");
  const db = tenantDb(ctx.organizationId);
  const before = await db.costCenter.findUnique({ where: { id } });
  if (!before) throw new NotFoundError();
  await db.costCenter.delete({ where: { id } });
  await recordAudit(db, ctx, { action: "cost_center.deleted", entityType: "CostCenter", entityId: id, before });
}

// ── Configurações ──────────────────────────────────────────────

export function parseSettings(raw: unknown): OrgSettings {
  const parsed = orgSettingsSchema.safeParse({ ...DEFAULT_ORG_SETTINGS, ...((raw as object) ?? {}) });
  return parsed.success ? parsed.data : DEFAULT_ORG_SETTINGS;
}

export async function getOrganizationSettings(ctx: ActorContext) {
  assertPermission(ctx, "org.profile.read");
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId }, select: { settings: true } });
  return parseSettings(org.settings);
}

export async function updateOrganizationSettings(ctx: ActorContext, input: OrgSettings) {
  assertPermission(ctx, "org.settings.manage");
  const db = tenantDb(ctx.organizationId);
  const before = await db.organization.findUniqueOrThrow({ where: { id: ctx.organizationId }, select: { settings: true } });
  await db.organization.update({ where: { id: ctx.organizationId }, data: { settings: input } });
  await recordAudit(db, ctx, { action: "organization.settings_updated", entityType: "Organization", entityId: ctx.organizationId, before: before.settings, after: input });
  return input;
}
