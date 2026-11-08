import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AuditTable } from "@/components/audit-table";
import { PageHeader } from "@/components/ui";
import { listPlatformAudit } from "@/modules/audit/audit.service";
import { hasPermission } from "@/modules/iam/rbac";
import { requireActor } from "@/modules/iam/session-context";

export default async function AdminAuditPage() {
  const ctx = await requireActor();
  if (!hasPermission(ctx, "platform.audit.read")) redirect("/app/forbidden");
  const t = await getTranslations();
  const rows = await listPlatformAudit(ctx, { take: 100 });
  return (
    <>
      <PageHeader title={t("audit.title")} description={t("admin.auditDesc")} />
      <AuditTable rows={rows} showOrganization />
    </>
  );
}
