import { prisma } from "@/lib/db";
import { isRoleKey, type Permission, type RoleKey } from "./permissions";
import type { ActorContext } from "./rbac";

export type LoadContextOptions = { sessionId?: string; ip?: string; userAgent?: string };

/**
 * Constrói o ActorContext a partir da BD (permissões lidas de role_permissions).
 * Independente do Next.js — usado por server actions e pelos testes.
 * Devolve null se o utilizador não tiver associação à organização.
 */
export async function loadActorContext(
  userId: string,
  organizationId: string,
  opts: LoadContextOptions = {},
): Promise<ActorContext | null> {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: {
      user: true,
      organization: true,
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });
  if (!membership || !isRoleKey(membership.role.key)) return null;

  const { user, organization, role } = membership;
  const userActive = user.status === "ACTIVE" && (!user.lockedUntil || user.lockedUntil <= new Date());
  const active = userActive && membership.status === "ACTIVE" && organization.status === "ACTIVE";
  const permissions = new Set<Permission>(
    active ? role.permissions.map((rp) => rp.permission.key as Permission) : [],
  );

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    sessionId: opts.sessionId,
    organizationId: organization.id,
    organizationName: organization.name,
    organizationStatus: organization.status,
    organizationType: organization.type,
    membershipId: membership.id,
    roleKey: role.key as RoleKey,
    permissions,
    isPlatform: organization.type === "PLATFORM",
    ip: opts.ip,
    userAgent: opts.userAgent,
  };
}

/** Organização por omissão: a primeira associação activa (plataforma primeiro). */
export async function defaultOrganizationId(userId: string): Promise<string | null> {
  const memberships = await prisma.membership.findMany({
    where: { userId, status: "ACTIVE" },
    include: { organization: { select: { type: true } } },
    orderBy: { createdAt: "asc" },
  });
  const platform = memberships.find((m) => m.organization.type === "PLATFORM");
  return (platform ?? memberships[0])?.organizationId ?? null;
}
