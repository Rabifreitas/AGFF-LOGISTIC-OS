import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { OrganizationStatus } from "@prisma/client";
import { Badge, EmptyState, Input, PageHeader, Select, Button, Table, Td, statusTone } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { hasPermission } from "@/modules/iam/rbac";
import { requireActor } from "@/modules/iam/session-context";
import { availableTransitions } from "@/modules/org/status";
import { listOrganizations } from "@/modules/platform/services/platform.service";
import { redirect } from "next/navigation";
import { TransitionForm } from "./transition-form";

const STATUSES: OrganizationStatus[] = ["PENDING_APPROVAL", "ACTIVE", "REJECTED", "SUSPENDED"];

export default async function AdminOrganizationsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const ctx = await requireActor();
  if (!hasPermission(ctx, "platform.organizations.read")) redirect("/app/forbidden");
  const t = await getTranslations();
  const locale = await getLocale();
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as OrganizationStatus) ? (sp.status as OrganizationStatus) : undefined;
  const orgs = await listOrganizations(ctx, { status, q: sp.q });
  return (
    <>
      <PageHeader title={t("nav.organizations")} description={t("admin.organizationsDesc")} />
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={sp.q} placeholder={t("common.search")} className="max-w-xs" aria-label={t("common.search")} />
        <Select name="status" defaultValue={status ?? ""} className="max-w-xs" aria-label={t("common.status")}>
          <option value="">{t("common.all")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </Select>
        <Button variant="secondary">{t("common.search")}</Button>
      </form>
      {orgs.length === 0 ? (
        <EmptyState title={t("admin.noOrganizations")} description={t("admin.noOrganizationsDesc")} />
      ) : (
        <Table head={[t("common.name"), "NIF", t("common.status"), t("admin.members"), t("admin.registeredAt"), t("common.actions")]}>
          {orgs.map((o) => (
            <tr key={o.id}>
              <Td>
                <Link href={`/admin/organizations/${o.id}`} className="font-medium text-navy-900 hover:underline">
                  {o.name}
                </Link>
                <p className="text-xs text-gray-500">
                  {t(`orgType.${o.type}`)} · {o.country} · {o.currency}
                </p>
              </Td>
              <Td className="font-mono text-xs">{o.nif}</Td>
              <Td>
                <Badge tone={statusTone(o.status)}>{t(`status.${o.status}`)}</Badge>
              </Td>
              <Td>{o._count.memberships}</Td>
              <Td className="text-xs">{formatDateTime(o.createdAt, locale)}</Td>
              <Td>
                <TransitionForm organizationId={o.id} transitions={availableTransitions(o.status)} />
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
