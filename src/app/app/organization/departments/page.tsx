import { getTranslations } from "next-intl/server";
import { Card, EmptyState, PageHeader, Table, Td } from "@/components/ui";
import { hasPermission } from "@/modules/iam/rbac";
import { requirePagePermission } from "@/modules/iam/session-context";
import { listDepartments } from "@/modules/org/services/org.service";
import { DepartmentForm } from "../forms";
import { RemoveButton } from "../remove-button";

export default async function DepartmentsPage() {
  const ctx = await requirePagePermission("org.profile.read");
  const t = await getTranslations();
  const departments = await listDepartments(ctx);
  const canManage = hasPermission(ctx, "org.departments.manage");
  return (
    <>
      <PageHeader title={t("org.departments")} description={t("org.departmentsDesc")} />
      {canManage && (
        <Card className="mb-6">
          <DepartmentForm />
        </Card>
      )}
      {departments.length === 0 ? (
        <EmptyState title={t("org.noDepartments")} />
      ) : (
        <Table head={[t("common.name"), t("org.code"), ""]}>
          {departments.map((d) => (
            <tr key={d.id}>
              <Td>{d.name}</Td>
              <Td>{d.code ?? "—"}</Td>
              <Td>{canManage && <RemoveButton id={d.id} kind="department" label={t("common.remove")} />}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
