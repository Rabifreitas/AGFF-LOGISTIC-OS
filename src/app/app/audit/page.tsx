import { getTranslations } from "next-intl/server";
import { AuditTable } from "@/components/audit-table";
import { PageHeader } from "@/components/ui";
import { listOrganizationAudit } from "@/modules/audit/audit.service";
import { requirePagePermission } from "@/modules/iam/session-context";

export const metadata = { title: "Auditoria" };

export default async function AuditPage() {
  const ctx = await requirePagePermission("audit.read");
  const t = await getTranslations("audit");
  const rows = await listOrganizationAudit(ctx, { take: 100 });
  return (
    <>
      <PageHeader title={t("title")} description={t("desc")} />
      <AuditTable rows={rows} />
    </>
  );
}
