import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertPermission, type ActorContext } from "@/modules/iam/rbac";
import { tenantDb } from "@/modules/tenancy/tenant-db";

const SENSITIVE_KEYS = new Set(["passwordHash", "tokenHash", "password", "token", "secret"]);

/** Remove campos sensíveis e normaliza Decimal/Date para JSON. */
export function sanitizeForAudit(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  const json = JSON.parse(JSON.stringify(value));
  const scrub = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(scrub);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .filter(([k]) => !SENSITIVE_KEYS.has(k))
          .map(([k, val]) => [k, scrub(val)]),
      );
    }
    return v;
  };
  return scrub(json) as Prisma.InputJsonValue;
}

export type AuditActor = Pick<ActorContext, "userId" | "ip" | "userAgent"> & { organizationId?: string | null };

export type AuditEntry = {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  /** Organização afectada; por omissão a do actor. */
  organizationId?: string | null;
};

type AuditWriter = { auditLog: { create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown> } };

export async function recordAudit(db: AuditWriter, actor: AuditActor | null, entry: AuditEntry) {
  await db.auditLog.create({
    data: {
      organizationId: entry.organizationId !== undefined ? entry.organizationId : (actor?.organizationId ?? null),
      userId: actor?.userId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      before: sanitizeForAudit(entry.before),
      after: sanitizeForAudit(entry.after),
      ipAddress: actor?.ip ?? null,
      userAgent: actor?.userAgent ?? null,
    },
  });
}

export type AuditListFilter = { entityType?: string; action?: string; take?: number; skip?: number };

export async function listOrganizationAudit(ctx: ActorContext, filter: AuditListFilter = {}) {
  assertPermission(ctx, "audit.read");
  const db = tenantDb(ctx.organizationId);
  return db.auditLog.findMany({
    where: { entityType: filter.entityType || undefined, action: filter.action || undefined },
    orderBy: { createdAt: "desc" },
    take: Math.min(filter.take ?? 50, 200),
    skip: filter.skip ?? 0,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

export async function listPlatformAudit(ctx: ActorContext, filter: AuditListFilter & { organizationId?: string } = {}) {
  assertPermission(ctx, "platform.audit.read");
  return prisma.auditLog.findMany({
    where: {
      organizationId: filter.organizationId || undefined,
      entityType: filter.entityType || undefined,
      action: filter.action || undefined,
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(filter.take ?? 50, 200),
    skip: filter.skip ?? 0,
    include: {
      user: { select: { id: true, name: true, email: true } },
      organization: { select: { id: true, name: true } },
    },
  });
}
