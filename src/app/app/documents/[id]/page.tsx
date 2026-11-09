import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TransitionButtons } from "@/components/transition-buttons";
import { Badge, Card, PageHeader, Table, Td, statusTone } from "@/components/ui";
import { isAppError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/utils";
import { transitionDocumentAction } from "@/modules/dms/actions";
import { availableDocumentTransitions, canUploadVersion, expiryState } from "@/modules/dms/document-status";
import { getDocument } from "@/modules/dms/services/document.service";
import { hasPermission } from "@/modules/iam/rbac";
import { requirePagePermission } from "@/modules/iam/session-context";
import { DocumentForm, VersionUploadForm } from "../forms";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission("dms.documents.read");
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const d = await getDocument(ctx, id).catch((e) => {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const editable = hasPermission(ctx, "dms.documents.manage") && canUploadVersion(d.status);
  const transitions = availableDocumentTransitions(d.status, (p) => hasPermission(ctx, p));
  const exp = d.status === "ARCHIVED" ? null : expiryState(d.expiresAt);

  const summary: [string, React.ReactNode][] = [
    [t("common.type"), t(`dms.types.${d.type}`)],
    [
      t("dms.shipment"),
      d.shipment ? (
        <Link href={`/app/shipments/${d.shipment.id}`} className="text-navy-900 hover:underline">
          {d.shipment.reference}
        </Link>
      ) : (
        t("common.none")
      ),
    ],
    [
      t("dms.expiresAt"),
      <>
        {formatDate(d.expiresAt, locale) || t("common.none")}
        {exp && (
          <span className="ml-2">
            <Badge tone={exp === "expired" ? "red" : "gold"}>{t(`dms.${exp}`)}</Badge>
          </span>
        )}
      </>,
    ],
    [t("dms.version"), d.currentVersion > 0 ? `v${d.currentVersion}` : t("common.none")],
    [t("dms.reviewedAt"), formatDateTime(d.reviewedAt, locale) || t("common.none")],
  ];

  return (
    <>
      <PageHeader title={d.title} description={t(`dms.types.${d.type}`)} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="text-navy-900 mb-4 font-semibold">{t("dms.versions")}</h2>
            {d.versions.length === 0 ? (
              <p className="mb-4 text-sm text-gray-500">{t("dms.noVersions")}</p>
            ) : (
              <Table
                head={[t("dms.version"), t("dms.fileName"), t("dms.size"), t("dms.checksum"), t("dms.uploadedAt"), ""]}
              >
                {d.versions.map((v) => (
                  <tr key={v.id}>
                    <Td>v{v.version}</Td>
                    <Td>{v.fileName}</Td>
                    <Td>{formatBytes(v.sizeBytes)}</Td>
                    <Td>
                      <code className="text-xs" title={v.checksumSha256}>
                        {v.checksumSha256.slice(0, 12)}…
                      </code>
                    </Td>
                    <Td>{formatDateTime(v.createdAt, locale)}</Td>
                    <Td>
                      <a
                        href={`/api/documents/${d.id}/versions/${v.version}`}
                        className="text-navy-800 text-sm hover:underline"
                      >
                        {t("dms.download")}
                      </a>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
            {editable ? (
              <div className="mt-4 space-y-2">
                {d.status !== "DRAFT" && <p className="text-sm text-gray-600">{t("dms.newVersionResets")}</p>}
                <VersionUploadForm documentId={d.id} />
              </div>
            ) : (
              d.status === "PENDING_REVIEW" && <p className="mt-4 text-sm text-gray-600">{t("dms.lockedHint")}</p>
            )}
          </Card>
          {editable && (
            <Card>
              <h2 className="text-navy-900 mb-4 font-semibold">{t("dms.details")}</h2>
              <DocumentForm document={d} />
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-navy-900 font-semibold">{t("common.status")}</h2>
              <Badge tone={statusTone(d.status)}>{t(`status.${d.status}`)}</Badge>
            </div>
            <dl className="mb-4 space-y-2 text-sm">
              {summary.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="text-right text-gray-900">{v}</dd>
                </div>
              ))}
            </dl>
            {d.reviewNotes && (
              <p className="mb-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                <span className="font-medium">{t("dms.reviewNotes")}:</span> {d.reviewNotes}
              </p>
            )}
            <TransitionButtons
              action={transitionDocumentAction}
              fields={{ id: d.id }}
              transitions={transitions}
              labelPrefix="dms.transition"
              danger={["reject", "archive"]}
              reasonFor={["reject"]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
