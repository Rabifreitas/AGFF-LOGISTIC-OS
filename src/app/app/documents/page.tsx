import type { DocumentStatus } from "@prisma/client";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, Table, Td, statusTone } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { expiryState } from "@/modules/dms/document-status";
import { listDocuments } from "@/modules/dms/services/document.service";
import { hasPermission } from "@/modules/iam/rbac";
import { requirePagePermission } from "@/modules/iam/session-context";
import { DocumentForm } from "./forms";

const STATUSES: DocumentStatus[] = ["DRAFT", "PENDING_REVIEW", "APPROVED", "REJECTED", "ARCHIVED"];

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("documents") };
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; expiry?: string }>;
}) {
  const ctx = await requirePagePermission("dms.documents.read");
  const t = await getTranslations();
  const locale = await getLocale();
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const expiring = sp.expiry === "expiring";
  const docs = await listDocuments(ctx, { status, expiring });
  const canManage = hasPermission(ctx, "dms.documents.manage");

  const filters = [
    { label: t("dms.filterAll"), href: "/app/documents", active: !status && !expiring },
    ...STATUSES.map((s) => ({ label: t(`status.${s}`), href: `/app/documents?status=${s}`, active: status === s })),
    { label: t("dms.filterExpiring"), href: "/app/documents?expiry=expiring", active: expiring },
  ];

  return (
    <>
      <PageHeader title={t("dms.title")} description={t("dms.desc")} />
      {canManage && (
        <Card className="mb-6">
          <h2 className="text-navy-900 mb-4 font-semibold">{t("dms.new")}</h2>
          <DocumentForm />
        </Card>
      )}
      <nav className="mb-4 flex flex-wrap gap-2 text-sm" aria-label={t("common.status")}>
        {filters.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            aria-current={f.active ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${f.active ? "border-navy-900 bg-navy-900 text-white" : "hover:border-gold-500 border-gray-300 text-gray-700"}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {docs.length === 0 ? (
        <EmptyState title={t("dms.empty")} description={t("dms.emptyDesc")} />
      ) : (
        <Table
          head={[
            t("dms.titleField"),
            t("common.type"),
            t("dms.shipment"),
            t("dms.version"),
            t("dms.expiresAt"),
            t("common.status"),
          ]}
        >
          {docs.map((d) => {
            const exp = d.status === "ARCHIVED" ? null : expiryState(d.expiresAt);
            return (
              <tr key={d.id}>
                <Td>
                  <Link href={`/app/documents/${d.id}`} className="text-navy-900 font-medium hover:underline">
                    {d.title}
                  </Link>
                </Td>
                <Td>{t(`dms.types.${d.type}`)}</Td>
                <Td>{d.shipment?.reference ?? t("common.none")}</Td>
                <Td>{d.currentVersion > 0 ? `v${d.currentVersion}` : t("common.none")}</Td>
                <Td>
                  {formatDate(d.expiresAt, locale) || t("common.none")}
                  {exp && (
                    <span className="ml-2">
                      <Badge tone={exp === "expired" ? "red" : "gold"}>{t(`dms.${exp}`)}</Badge>
                    </span>
                  )}
                </Td>
                <Td>
                  <Badge tone={statusTone(d.status)}>{t(`status.${d.status}`)}</Badge>
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
