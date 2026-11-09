import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { TransitionButtons } from "@/components/transition-buttons";
import { Badge, Card, EmptyState, PageHeader, Table, Td, statusTone } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { hasPermission } from "@/modules/iam/rbac";
import { requirePagePermission } from "@/modules/iam/session-context";
import { tenantDb } from "@/modules/tenancy/tenant-db";
import { transitionIncidentAction } from "@/modules/trk/actions";
import { availableIncidentTransitions } from "@/modules/trk/incident-status";
import { listIncidents } from "@/modules/trk/services/incident.service";
import { IncidentForm } from "../shipments/forms";

export const metadata = { title: "Incidentes" };

export default async function IncidentsPage() {
  const ctx = await requirePagePermission("incidents.read");
  const t = await getTranslations();
  const locale = await getLocale();
  const canManage = hasPermission(ctx, "incidents.manage");
  const [incidents, shipments] = await Promise.all([
    listIncidents(ctx),
    canManage && hasPermission(ctx, "tms.shipments.read")
      ? tenantDb(ctx.organizationId).shipment.findMany({
          where: { status: { notIn: ["DELIVERED", "CANCELLED"] } },
          select: { id: true, reference: true },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title={t("incidents.title")} description={t("incidents.desc")} />
      {canManage && (
        <Card className="mb-6">
          <h2 className="text-navy-900 mb-4 font-semibold">{t("incidents.new")}</h2>
          <IncidentForm shipments={shipments.map((s) => ({ value: s.id, label: s.reference }))} />
        </Card>
      )}
      {incidents.length === 0 ? (
        <EmptyState title={t("incidents.empty")} description={t("incidents.emptyDesc")} />
      ) : (
        <Table
          head={[
            t("incidents.titleField"),
            t("incidents.severity"),
            t("trk.shipment"),
            t("incidents.openedAt"),
            t("common.status"),
            canManage ? t("common.actions") : null,
          ].filter((h) => h !== null)}
        >
          {incidents.map((inc) => (
            <tr key={inc.id}>
              <Td>
                <p className="font-medium">{inc.title}</p>
                {inc.description && <p className="text-xs text-gray-600">{inc.description}</p>}
                {inc.resolution && <p className="text-xs text-green-800">{inc.resolution}</p>}
              </Td>
              <Td>
                <Badge tone={statusTone(inc.severity)}>{t(`incidents.severities.${inc.severity}`)}</Badge>
              </Td>
              <Td>
                {inc.shipment ? (
                  <Link href={`/app/shipments/${inc.shipment.id}`} className="font-mono hover:underline">
                    {inc.shipment.reference}
                  </Link>
                ) : (
                  t("common.none")
                )}
              </Td>
              <Td className="text-xs text-gray-600">{formatDateTime(inc.createdAt, locale)}</Td>
              <Td>
                <Badge tone={statusTone(inc.status)}>{t(`status.${inc.status}`)}</Badge>
              </Td>
              {canManage && (
                <Td>
                  <TransitionButtons
                    action={transitionIncidentAction}
                    fields={{ id: inc.id, back: "/app/incidents" }}
                    transitions={availableIncidentTransitions(inc.status)}
                    labelPrefix="incidents.transition"
                    reasonFor={["resolve"]}
                    size="sm"
                  />
                </Td>
              )}
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
