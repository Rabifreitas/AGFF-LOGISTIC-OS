import { getLocale, getTranslations } from "next-intl/server";
import { Badge, Card, EmptyState, PageHeader, statusTone } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { hasPermission } from "@/modules/iam/rbac";
import { requireActiveOrgActor } from "@/modules/iam/session-context";
import { countExpiringDocuments } from "@/modules/dms/services/document.service";
import { countUnread } from "@/modules/notifications/notification.service";
import { MODULES } from "@/modules/registry";
import { ACTIVE_SHIPMENT_STATUSES } from "@/modules/shp/shipment-status";
import { tenantDb } from "@/modules/tenancy/tenant-db";
import Link from "next/link";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("dashboard") };
}

export default async function DashboardPage() {
  const ctx = await requireActiveOrgActor();
  const t = await getTranslations();
  const locale = await getLocale();
  const db = tenantDb(ctx.organizationId);
  const canSeeTeam = hasPermission(ctx, "iam.members.read");
  const canSeeShipments = hasPermission(ctx, "tms.shipments.read");
  const canSeeIncidents = hasPermission(ctx, "incidents.read");
  const canSeePartners = hasPermission(ctx, "mkt.partners.read");
  const canSeeDocuments = hasPermission(ctx, "dms.documents.read");
  const none = Promise.resolve(null);
  const [members, invites, unread, active, moving, incidents, partners, expiringDocs, recent] = await Promise.all([
    canSeeTeam ? db.membership.count({ where: { status: "ACTIVE" } }) : none,
    canSeeTeam ? db.userInvite.count({ where: { status: "PENDING" } }) : none,
    countUnread(ctx),
    canSeeShipments ? db.shipment.count({ where: { status: { in: [...ACTIVE_SHIPMENT_STATUSES] } } }) : none,
    canSeeShipments ? db.shipment.count({ where: { status: { in: ["IN_TRANSIT", "AT_CUSTOMS"] } } }) : none,
    canSeeIncidents ? db.incident.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }) : none,
    canSeePartners ? db.partner.count({ where: { status: "VERIFIED" } }) : none,
    canSeeDocuments ? countExpiringDocuments(ctx) : none,
    canSeeShipments
      ? db.shipment.findMany({
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: { id: true, reference: true, status: true, updatedAt: true },
        })
      : Promise.resolve([]),
  ]);
  const stats = [
    { label: t("dashboard.activeShipments"), value: active, href: "/app/shipments" },
    { label: t("dashboard.inTransit"), value: moving, href: "/app/shipments?status=IN_TRANSIT" },
    { label: t("dashboard.openIncidents"), value: incidents, href: "/app/incidents" },
    { label: t("dashboard.verifiedPartners"), value: partners, href: "/app/partners" },
    { label: t("dashboard.expiringDocuments"), value: expiringDocs, href: "/app/documents?expiry=expiring" },
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
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const card = (
            <Card className={s.href ? "hover:border-gold-500 h-full" : "h-full"}>
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className="text-navy-900 mt-1 text-3xl font-semibold">{s.value}</p>
            </Card>
          );
          return s.href ? (
            <Link key={s.label} href={s.href}>
              {card}
            </Link>
          ) : (
            <div key={s.label}>{card}</div>
          );
        })}
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
      {recent.length === 0 ? (
        <EmptyState title={t("dashboard.noActivity")} description={t("dashboard.noActivityDesc")} />
      ) : (
        <Card>
          <h2 className="text-navy-900 mb-3 font-semibold">{t("dashboard.recentShipments")}</h2>
          <ul className="divide-y divide-gray-100">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/app/shipments/${r.id}`} className="text-navy-900 font-mono hover:underline">
                  {r.reference}
                </Link>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">{formatDateTime(r.updatedAt, locale)}</span>
                  <Badge tone={statusTone(r.status)}>{t(`status.${r.status}`)}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
