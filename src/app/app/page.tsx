import { getTranslations } from "next-intl/server";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { hasPermission } from "@/modules/iam/rbac";
import { requireActiveOrgActor } from "@/modules/iam/session-context";
import { countUnread } from "@/modules/notifications/notification.service";
import { MODULES } from "@/modules/registry";
import { tenantDb } from "@/modules/tenancy/tenant-db";
import Link from "next/link";

export const metadata = { title: "Painel" };

export default async function DashboardPage() {
  const ctx = await requireActiveOrgActor();
  const t = await getTranslations();
  const db = tenantDb(ctx.organizationId);
  const canSeeTeam = hasPermission(ctx, "iam.members.read");
  const [members, invites, unread] = await Promise.all([
    canSeeTeam ? db.membership.count({ where: { status: "ACTIVE" } }) : Promise.resolve(null),
    canSeeTeam ? db.userInvite.count({ where: { status: "PENDING" } }) : Promise.resolve(null),
    countUnread(ctx),
  ]);
  const stats = [
    { label: t("dashboard.members"), value: members },
    { label: t("dashboard.pendingInvites"), value: invites },
    { label: t("dashboard.unread"), value: unread },
  ].filter((s) => s.value !== null);

  return (
    <>
      <PageHeader
        title={t("dashboard.welcome", { name: ctx.name })}
        description={t("dashboard.subtitle", { org: ctx.organizationName, role: t(`roles.${ctx.roleKey}`) })}
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-navy-900 mt-1 text-3xl font-semibold">{s.value}</p>
          </Card>
        ))}
      </div>
      <h2 className="text-navy-900 mb-1 text-lg font-semibold">{t("dashboard.modulesTitle")}</h2>
      <p className="mb-4 text-sm text-gray-600">{t("dashboard.modulesDesc")}</p>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.filter((m) => !m.permission || hasPermission(ctx, m.permission)).map((m) => {
          const inner = (
            <Card className={m.status === "planned" ? "h-full opacity-70" : "hover:border-gold-500 h-full"}>
              <div className="flex items-center justify-between">
                <span className="text-gold-600 text-xs font-semibold">{m.code}</span>
                {m.status === "planned" ? (
                  <Badge>{t("dashboard.plannedModule", { n: m.phase })}</Badge>
                ) : (
                  <Badge tone="green">{t("status.ACTIVE")}</Badge>
                )}
              </div>
              <p className="text-navy-900 mt-2 font-medium">{t(`nav.${m.key}`)}</p>
            </Card>
          );
          return m.href ? (
            <Link key={m.code} href={m.href}>
              {inner}
            </Link>
          ) : (
            <div key={m.code}>{inner}</div>
          );
        })}
      </div>
      <EmptyState title={t("dashboard.noActivity")} description={t("dashboard.noActivityDesc")} />
    </>
  );
}
