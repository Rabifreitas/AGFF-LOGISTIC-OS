import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, Table, Td, statusTone } from "@/components/ui";
import { hasPermission } from "@/modules/iam/rbac";
import { requirePagePermission } from "@/modules/iam/session-context";
import { listPartners } from "@/modules/mkt/services/partner.service";
import { PartnerForm } from "./forms";

export const metadata = { title: "Parceiros" };

export default async function PartnersPage() {
  const ctx = await requirePagePermission("mkt.partners.read");
  const t = await getTranslations();
  const partners = await listPartners(ctx);
  const canManage = hasPermission(ctx, "mkt.partners.manage");

  return (
    <>
      <PageHeader title={t("partners.title")} description={t("partners.desc")} />
      {canManage && (
        <Card className="mb-6">
          <h2 className="text-navy-900 mb-4 font-semibold">{t("partners.new")}</h2>
          <PartnerForm />
        </Card>
      )}
      {partners.length === 0 ? (
        <EmptyState title={t("partners.empty")} description={t("partners.emptyDesc")} />
      ) : (
        <Table head={[t("common.name"), t("common.type"), t("partners.nif"), t("common.country"), t("common.status")]}>
          {partners.map((p) => (
            <tr key={p.id}>
              <Td>
                <Link href={`/app/partners/${p.id}`} className="text-navy-900 font-medium hover:underline">
                  {p.name}
                </Link>
              </Td>
              <Td>{t(`partners.type.${p.type}`)}</Td>
              <Td>{p.nif ?? t("common.none")}</Td>
              <Td>{p.country}</Td>
              <Td>
                <Badge tone={statusTone(p.status)}>{t(`status.${p.status}`)}</Badge>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
