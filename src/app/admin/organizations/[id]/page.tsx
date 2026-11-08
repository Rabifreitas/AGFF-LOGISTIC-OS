import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { AuditTable } from "@/components/audit-table";
import { Badge, Card, PageHeader, Table, Td, statusTone } from "@/components/ui";
import { isAppError } from "@/lib/errors";
import { listPlatformAudit } from "@/modules/audit/audit.service";
import { hasPermission } from "@/modules/iam/rbac";
import { requireActor } from "@/modules/iam/session-context";
import { availableTransitions } from "@/modules/org/status";
import { getOrganizationForAdmin } from "@/modules/platform/services/platform.service";
import { TransitionForm } from "../../transition-form";

export default async function AdminOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireActor();
  if (!hasPermission(ctx, "platform.organizations.read")) redirect("/app/forbidden");
  const { id } = await params;
  const t = await getTranslations();
  const org = await getOrganizationForAdmin(ctx, id).catch((e) => {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const audit = hasPermission(ctx, "platform.audit.read")
    ? await listPlatformAudit(ctx, { organizationId: id, take: 50 })
    : [];
  const fields: [string, string | null][] = [
    ["org.legalName", org.legalName],
    ["org.nif", org.nif],
    ["common.country", org.country],
    ["common.currency", org.currency],
    ["common.email", org.email],
    ["common.phone", org.phone],
    ["org.taxRegime", org.taxRegime],
    ["org.commercialRegistry", org.commercialRegistry],
  ];
  return (
    <>
      <PageHeader
        title={org.name}
        description={t(`orgType.${org.type}`)}
        actions={<Badge tone={statusTone(org.status)}>{t(`status.${org.status}`)}</Badge>}
      />
      <Card className="mb-6">
        <dl className="grid gap-3 text-sm md:grid-cols-4">
          {fields.map(([k, v]) => (
            <div key={k}>
              <dt className="text-gray-500">{t(k)}</dt>
              <dd className="text-navy-900">{v || "—"}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6">
          <TransitionForm organizationId={org.id} transitions={availableTransitions(org.status)} />
        </div>
      </Card>
      <h2 className="text-navy-900 mb-3 font-semibold">{t("admin.members")}</h2>
      <Table head={[t("common.name"), t("team.role"), t("common.status")]}>
        {org.memberships.map((m) => (
          <tr key={m.id}>
            <Td>
              {m.user.name}
              <span className="block text-xs text-gray-500">{m.user.email}</span>
            </Td>
            <Td>{t(`roles.${m.role.key}`)}</Td>
            <Td>
              <Badge tone={statusTone(m.status)}>{t(`status.${m.status}`)}</Badge>
            </Td>
          </tr>
        ))}
      </Table>
      {audit.length > 0 && (
        <>
          <h2 className="text-navy-900 mt-8 mb-3 font-semibold">{t("audit.title")}</h2>
          <AuditTable rows={audit} />
        </>
      )}
    </>
  );
}
