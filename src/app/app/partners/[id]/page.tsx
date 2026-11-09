import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TransitionButtons } from "@/components/transition-buttons";
import { Badge, Card, PageHeader, Table, Td, statusTone } from "@/components/ui";
import { isAppError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/utils";
import { hasPermission } from "@/modules/iam/rbac";
import { requirePagePermission } from "@/modules/iam/session-context";
import { reviewVerificationAction, transitionPartnerAction } from "@/modules/mkt/actions";
import { availablePartnerTransitions } from "@/modules/mkt/partner-status";
import { getPartner } from "@/modules/mkt/services/partner.service";
import { PartnerForm, VerificationForm } from "../forms";

export default async function PartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission("mkt.partners.read");
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const partner = await getPartner(ctx, id).catch((e) => {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const canManage = hasPermission(ctx, "mkt.partners.manage");

  return (
    <>
      <Link href="/app/partners" className="text-sm text-gray-600 hover:underline">
        ← {t("common.back")}
      </Link>
      <PageHeader
        title={partner.name}
        description={`${t(`partners.type.${partner.type}`)} · ${partner.country}`}
        actions={<Badge tone={statusTone(partner.status)}>{t(`status.${partner.status}`)}</Badge>}
      />
      {canManage && (
        <div className="mb-6">
          <TransitionButtons
            action={transitionPartnerAction}
            fields={{ id: partner.id }}
            transitions={availablePartnerTransitions(partner.status)}
            labelPrefix="partners.transition"
            danger={["reject", "suspend"]}
          />
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-navy-900 mb-4 font-semibold">{t("common.details")}</h2>
          {canManage ? (
            <PartnerForm
              partner={{
                id: partner.id,
                type: partner.type,
                name: partner.name,
                nif: partner.nif,
                country: partner.country,
                email: partner.email,
                phone: partner.phone,
                notes: partner.notes,
              }}
            />
          ) : (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-gray-500">{t("partners.nif")}</dt>
              <dd>{partner.nif ?? t("common.none")}</dd>
              <dt className="text-gray-500">{t("common.email")}</dt>
              <dd>{partner.email ?? t("common.none")}</dd>
              <dt className="text-gray-500">{t("common.phone")}</dt>
              <dd>{partner.phone ?? t("common.none")}</dd>
            </dl>
          )}
        </Card>
        <Card>
          <h2 className="text-navy-900 font-semibold">{t("partners.verifications")}</h2>
          <p className="mb-4 text-sm text-gray-600">{t("partners.verificationsDesc")}</p>
          {partner.verifications.length === 0 ? (
            <p className="mb-4 text-sm text-gray-500">{t("partners.noVerifications")}</p>
          ) : (
            <div className="mb-4">
              <Table
                head={[t("partners.kind"), t("partners.expiresAt"), t("common.status"), t("partners.reviewedAt"), ""]}
              >
                {partner.verifications.map((v) => (
                  <tr key={v.id}>
                    <Td>{t.has(`partners.kinds.${v.kind}`) ? t(`partners.kinds.${v.kind}`) : v.kind}</Td>
                    <Td>{formatDate(v.expiresAt, locale)}</Td>
                    <Td>
                      <Badge tone={statusTone(v.status)}>{t(`status.${v.status}`)}</Badge>
                    </Td>
                    <Td className="text-xs text-gray-600">{formatDateTime(v.reviewedAt, locale)}</Td>
                    <Td>
                      {canManage && v.status === "PENDING" && (
                        <TransitionButtons
                          action={reviewVerificationAction}
                          fields={{ id: v.id, partnerId: partner.id }}
                          transitions={["APPROVED", "REJECTED"]}
                          labelPrefix="partners.review"
                          danger={["REJECTED"]}
                          size="sm"
                        />
                      )}
                    </Td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
          {canManage && <VerificationForm partnerId={partner.id} />}
        </Card>
      </div>
    </>
  );
}
