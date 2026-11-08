import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ALL_PERMISSIONS, PERMISSIONS, ROLE_DEFINITIONS, ROLE_KEYS, permissionModule } from "../src/modules/iam/permissions";

/** Sincroniza o catálogo RBAC (idempotente). Usado pelo seed e pelos testes. */
export async function syncRbac(prisma: PrismaClient) {
  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: { description: PERMISSIONS[key], module: permissionModule(key) },
      create: { key, description: PERMISSIONS[key], module: permissionModule(key) },
    });
  }
  const permissions = await prisma.permission.findMany();
  const idByKey = new Map(permissions.map((p) => [p.key, p.id]));

  for (const key of ROLE_KEYS) {
    const def = ROLE_DEFINITIONS[key];
    const existing = await prisma.role.findFirst({ where: { key, organizationId: null } });
    const role = existing
      ? await prisma.role.update({ where: { id: existing.id }, data: { name: def.name, description: def.description, scope: def.scope } })
      : await prisma.role.create({ data: { key, name: def.name, description: def.description, scope: def.scope, isSystem: true } });
    const wanted = def.permissions.map((p) => idByKey.get(p)!).filter(Boolean);
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: { notIn: wanted } } });
    await prisma.rolePermission.createMany({
      data: wanted.map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
  }
}

export const PLATFORM_NIF = "AGFF-PLATFORM";

export async function ensurePlatform(
  prisma: PrismaClient,
  admin: { email: string; password: string; name: string },
) {
  const platform = await prisma.organization.upsert({
    where: { nif: PLATFORM_NIF },
    update: {},
    create: {
      name: "AGFF Logistics OS",
      legalName: "AGFF Logistics OS (Plataforma)",
      nif: PLATFORM_NIF,
      type: "PLATFORM",
      status: "ACTIVE",
      email: admin.email,
      approvedAt: new Date(),
    },
  });
  const email = admin.email.trim().toLowerCase();
  const user =
    (await prisma.user.findUnique({ where: { email } })) ??
    (await prisma.user.create({
      data: { email, name: admin.name, passwordHash: await bcrypt.hash(admin.password, 12), passwordChangedAt: new Date() },
    }));
  const role = await prisma.role.findFirstOrThrow({ where: { key: "SUPER_ADMIN", organizationId: null } });
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: platform.id } },
    update: {},
    create: { userId: user.id, organizationId: platform.id, roleId: role.id },
  });
  return { platform, user };
}
