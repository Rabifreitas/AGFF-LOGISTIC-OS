import { getTranslations } from "next-intl/server";
import { Card, PageHeader } from "@/components/ui";
import { hasPermission } from "@/modules/iam/rbac";
import { requirePagePermission } from "@/modules/iam/session-context";
import { getOrganizationSettings } from "@/modules/org/services/org.service";
import { SettingsForm } from "../forms";

export default async function SettingsPage() {
  const ctx = await requirePagePermission("org.profile.read");
  const t = await getTranslations();
  const settings = await getOrganizationSettings(ctx);
  const canManage = hasPermission(ctx, "org.settings.manage");
  return (
    <>
      <PageHeader title={t("org.settings")} description={t("org.settingsDesc")} />
      <Card>
        {canManage ? (
          <SettingsForm settings={settings} />
        ) : (
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            {Object.entries(settings).map(([k, v]) => (
              <div key={k}>
                <dt className="text-gray-500">{t(`org.${k}` as "org.timezone")}</dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
    </>
  );
}
