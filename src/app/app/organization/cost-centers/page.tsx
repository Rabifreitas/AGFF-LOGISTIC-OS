import { getTranslations } from "next-intl/server";
import { Badge, Card, EmptyState, PageHeader, Table, Td } from "@/components/ui";
import { hasPermission } from "@/modules/iam/rbac";
import { requirePagePermission } from "@/modules/iam/session-context";
import { toggleCostCenterAction } from "@/modules/org/actions";
import { listCostCenters, listDepartments } from "@/modules/org/services/org.service";
import { CostCenterForm } from "../forms";
import { RemoveButton } from "../remove-button";

export default async function CostCentersPage() {
  const ctx = await requirePagePermission("org.cost_centers.read");
  const t = await getTranslations();
  const [costCenters, departments] = await Promise.all([listCostCenters(ctx), listDepartments(ctx)]);
  const canManage = hasPermission(ctx, "org.cost_centers.manage");
  return (
    <>
      <PageHeader title={t("org.costCenters")} description={t("org.costCentersDesc")} />
      {canManage && (
        <Card className="mb-6">
          <CostCenterForm departments={departments} />
        </Card>
      )}
      {costCenters.length === 0 ? (
        <EmptyState title={t("org.noCostCenters")} />
      ) : (
        <Table head={[t("org.code"), t("common.name"), t("org.department"), t("common.status"), ""]}>
          {costCenters.map((c) => (
            <tr key={c.id}>
              <Td className="font-mono">{c.code}</Td>
              <Td>{c.name}</Td>
              <Td>{c.department?.name ?? "—"}</Td>
              <Td>
                <Badge tone={c.active ? "green" : "gray"}>{c.active ? t("org.active") : t("org.inactive")}</Badge>
              </Td>
              <Td>
                {canManage && (
                  <div className="flex gap-3">
                    <form action={toggleCostCenterAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="active" value={String(!c.active)} />
                      <button className="text-xs text-navy-700 hover:underline">{c.active ? t("org.deactivate") : t("org.activate")}</button>
                    </form>
                    <RemoveButton id={c.id} kind="costCenter" label={t("common.remove")} />
                  </div>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
