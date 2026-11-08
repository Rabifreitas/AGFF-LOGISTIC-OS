import { ForbiddenError } from "@/lib/errors";
import {
  ORGANIZATION_ROLE_KEYS,
  PLATFORM_ROLE_KEYS,
  ROLE_DEFINITIONS,
  type Permission,
  type RoleKey,
} from "./permissions";

/** Contexto de um actor autenticado num tenant (organização activa). */
export type ActorContext = {
  userId: string;
  email: string;
  name: string;
  sessionId?: string;
  organizationId: string;
  organizationName: string;
  organizationStatus: string;
  organizationType: string;
  membershipId: string;
  roleKey: RoleKey;
  /** Vazio quando a organização ou a associação não estão activas. */
  permissions: ReadonlySet<Permission>;
  isPlatform: boolean;
  ip?: string;
  userAgent?: string;
};

export type PermissionHolder = Pick<ActorContext, "permissions">;

export function hasPermission(ctx: PermissionHolder, permission: Permission): boolean {
  return ctx.permissions.has(permission);
}

export function hasAnyPermission(ctx: PermissionHolder, permissions: Permission[]): boolean {
  return permissions.some((p) => ctx.permissions.has(p));
}

export function assertPermission(ctx: PermissionHolder, permission: Permission): void {
  if (!hasPermission(ctx, permission)) {
    throw new ForbiddenError("errors.forbidden", { permission });
  }
}

export function roleHasPermission(roleKey: RoleKey, permission: Permission): boolean {
  return ROLE_DEFINITIONS[roleKey].permissions.includes(permission);
}

/**
 * Anti-escalada de privilégios: um actor só pode atribuir perfis cujo conjunto
 * de permissões esteja contido no seu. Perfis de plataforma só são atribuíveis
 * dentro da organização da plataforma.
 */
export function assignableRoleKeys(ctx: PermissionHolder & { isPlatform: boolean }): RoleKey[] {
  const candidates = ctx.isPlatform ? PLATFORM_ROLE_KEYS : ORGANIZATION_ROLE_KEYS;
  return candidates.filter((key) => ROLE_DEFINITIONS[key].permissions.every((p) => ctx.permissions.has(p)));
}

export function assertCanAssignRole(ctx: PermissionHolder & { isPlatform: boolean }, roleKey: RoleKey): void {
  if (!assignableRoleKeys(ctx).includes(roleKey)) {
    throw new ForbiddenError("errors.roleNotAssignable", { roleKey });
  }
}
