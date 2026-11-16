import { getLocale, getTranslations } from "next-intl/server";
import { Badge, EmptyState, PageHeader, Table, Td, statusTone } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { requirePagePermission } from "@/modules/iam/session-context";
import { availableProviderReviews } from "@/modules/mkt/auction-rules";
import { listProviderProfiles } from "@/modules/mkt/services/auction.service";
import { ProviderReviewForm } from "./forms";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("providers") };
}

export default async function AdminProvidersPage() {
  const ctx = await requirePagePermission("platform.providers.verify");
  const t = await getTranslations();
  const locale = await getLocale();
  const profiles = await listProviderProfiles(ctx);
  return (
    <>
      <PageHeader title={t("mkt.admin.title")} description={t("mkt.admin.desc")} />
      {profiles.length === 0 ? (
        <EmptyState title={t("mkt.admin.empty")} description={t("mkt.admin.desc")} />
      ) : (
        <Table
          head={[
            t("mkt.provider.company"),
            t("mkt.provider.modes"),
            t("mkt.provider.services"),
            t("mkt.validUntil"),
            t("common.status"),
            "",
          ]}
        >
          {profiles.map((p) => (
            <tr key={p.id}>
              <Td>
                <span className="font-medium">{p.organization.name}</span>
                <span className="block font-mono text-xs text-gray-500">
                  {p.organization.nif} · {p.organization.country}
                </span>
              </Td>
              <Td>{p.modes.map((m) => t(`shp.modes.${m}`)).join(", ") || t("common.none")}</Td>
              <Td>{p.services.map((s) => t(`shp.services.${s}`)).join(", ") || t("common.none")}</Td>
              <Td>{p.validUntil ? formatDate(p.validUntil, locale) : t("common.none")}</Td>
              <Td>
                <Badge tone={statusTone(p.status)}>{t(`mkt.providerStatus.${p.status}`)}</Badge>
              </Td>
              <Td>
                <ProviderReviewForm id={p.id} decisions={availableProviderReviews(p.status)} />
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
