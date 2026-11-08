/**
 * Regras puras de isolamento multi-tenant aplicadas a cada query Prisma.
 * Testadas em tests/unit/tenant-scope.test.ts.
 */

/** Modelos com organizationId obrigatório (entidades empresariais). */
export const TENANT_SCOPED_MODELS = new Set<string>([
  "OrganizationAddress",
  "OrganizationContact",
  "OrganizationRepresentative",
  "Department",
  "CostCenter",
  "Membership",
  "UserInvite",
  "Notification",
  "AuditLog",
  // Fase 2
  "Partner",
  "PartnerVerification",
  "Shipment",
  "ShipmentStop",
  "ShipmentItem",
  "Quotation",
  "Document",
  "DocumentVersion",
  "TrackingEvent",
  "Incident",
]);

const WHERE_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
]);

type Args = Record<string, unknown> | undefined;
type Data = Record<string, unknown>;

function stripTenant(data: unknown): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const { organizationId: _ignored, organization: _rel, ...rest } = data as Data;
  return rest;
}

function withTenant(data: unknown, organizationId: string): Data {
  return { ...(stripTenant(data) as Data), organizationId };
}

/**
 * Devolve os argumentos com o filtro/valor de organizationId forçado.
 * Qualquer organizationId vindo do chamador é sobreposto (não pode ser falsificado).
 */
export function applyTenantScope(
  model: string,
  operation: string,
  args: Args,
  organizationId: string,
): Record<string, unknown> {
  if (!organizationId) throw new Error("Tenant scope requires an organizationId");
  const a: Data = { ...(args ?? {}) };

  if (model === "Organization") {
    if (WHERE_OPERATIONS.has(operation)) a.where = { ...((a.where as Data) ?? {}), id: organizationId };
    if (operation.startsWith("create") || operation === "upsert") {
      throw new Error("Organizations cannot be created through a tenant-scoped client");
    }
    return a;
  }

  if (!TENANT_SCOPED_MODELS.has(model)) return a;

  if (WHERE_OPERATIONS.has(operation)) {
    a.where = { ...((a.where as Data) ?? {}), organizationId };
  }
  if (operation === "update" || operation === "updateMany" || operation === "updateManyAndReturn") {
    a.data = stripTenant(a.data);
  }
  if (operation === "create") {
    a.data = withTenant(a.data, organizationId);
  }
  if (operation === "createMany" || operation === "createManyAndReturn") {
    const list = Array.isArray(a.data) ? a.data : [a.data];
    a.data = list.map((d) => withTenant(d, organizationId));
  }
  if (operation === "upsert") {
    a.where = { ...((a.where as Data) ?? {}), organizationId };
    a.create = withTenant(a.create, organizationId);
    a.update = stripTenant(a.update);
  }
  return a;
}
