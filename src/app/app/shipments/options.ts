import { hasPermission, type ActorContext } from "@/modules/iam/rbac";
import { tenantDb } from "@/modules/tenancy/tenant-db";

/** Opções dos selectores de expedição, sempre lidas no tenant actual. */
export async function shipmentFormOptions(ctx: ActorContext) {
  const db = tenantDb(ctx.organizationId);
  const [partners, costCenters, org] = await Promise.all([
    db.partner.findMany({
      where: { status: { notIn: ["REJECTED", "SUSPENDED"] } },
      select: { id: true, name: true, type: true, status: true },
      orderBy: { name: "asc" },
    }),
    hasPermission(ctx, "org.cost_centers.read") || hasPermission(ctx, "tms.shipments.manage")
      ? db.costCenter.findMany({ where: { active: true }, orderBy: { code: "asc" } })
      : Promise.resolve([]),
    db.organization.findUnique({ where: { id: ctx.organizationId }, select: { currency: true } }),
  ]);
  return {
    customers: partners.filter((p) => p.type === "CUSTOMER").map((p) => ({ value: p.id, label: p.name })),
    carriers: partners
      .filter((p) => p.type === "TRANSPORTER" || p.type === "FREIGHT_FORWARDER")
      .map((p) => ({ value: p.id, label: p.status === "VERIFIED" ? `${p.name} ✓` : p.name })),
    costCenters: costCenters.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
    defaultCurrency: org?.currency ?? "AOA",
  };
}
