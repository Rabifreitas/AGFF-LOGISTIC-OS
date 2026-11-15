import { getLocale, getTranslations } from "next-intl/server";
import { Badge, Card, statusTone } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { requirePagePermission } from "@/modules/iam/session-context";
import { getOwnProviderProfile } from "@/modules/mkt/services/auction.service";
import { ProviderProfileForm, SubmitProviderButton } from "./forms";

export async function generateMetadata() {
  const t = await getTranslations("mkt.provider");
  return { title: t("title") };
}

export default async function ProviderProfilePage() {
  const ctx = await requirePagePermission("mkt.provider.manage");
  const t = await getTranslations();
  const locale = await getLocale();
  const profile = await getOwnProviderProfile(ctx);
  const canSubmit = profile && (profile.status === "DRAFT" || profile.status === "REJECTED");
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <h1 className="text-navy-900 text-lg font-semibold">{t("mkt.provider.title")}</h1>
        <p className="mb-4 text-sm text-gray-600">{t("mkt.provider.desc")}</p>
        <ProviderProfileForm profile={profile} />
      </Card>
      <Card>
        <p className="text-xs tracking-wide text-gray-500 uppercase">{t("common.status")}</p>
        <div className="mt-2">
          <Badge tone={statusTone(profile?.status ?? "DRAFT")}>
            {t(`mkt.providerStatus.${profile?.status ?? "DRAFT"}`)}
          </Badge>
        </div>
        {profile?.statusReason && <p className="mt-2 text-sm text-gray-700">{profile.statusReason}</p>}
        {profile?.validUntil && (
          <p className="mt-2 text-sm">
            {t("mkt.validUntil")}: {formatDate(profile.validUntil, locale)}
          </p>
        )}
        <p className="mt-3 text-sm text-gray-600">{t("mkt.provider.verifyNote")}</p>
        {canSubmit && (
          <div className="mt-4">
            <SubmitProviderButton />
          </div>
        )}
      </Card>
    </div>
  );
}
