import { hasPermission, type ActorContext } from "@/modules/iam/rbac";
import { tenantDb } from "@/modules/tenancy/tenant-db";

/** Opções dos selectores de expedição, sempre lidas no tenant actual. */
export async function shipmentFormOptions(ctx: ActorContext, keepIds: (string | null)[] = []) {
  const db = tenantDb(ctx.organizationId);
  const [partners, costCenters, org] = await Promise.all([
    db.partner.findMany({
      // Mantém os parceiros já associados, mesmo suspensos, para não os apagar ao gravar.
      where: {
        OR: [{ status: { notIn: ["REJECTED", "SUSPENDED"] } }, { id: { in: keepIds.filter((id) => id !== null) } }],
      },
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
