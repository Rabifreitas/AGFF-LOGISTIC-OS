import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Badge, EmptyState, PageHeader, Table, Td, statusTone } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { requirePagePermission } from "@/modules/iam/session-context";
import { listTrackingEvents } from "@/modules/trk/services/tracking.service";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("tracking") };
}

export default async function TrackingPage() {
  const ctx = await requirePagePermission("trk.events.read");
  const t = await getTranslations();
  const locale = await getLocale();
  const events = await listTrackingEvents(ctx);
  return (
    <>
      <PageHeader title={t("trk.title")} description={t("trk.desc")} />
      {events.length === 0 ? (
        <EmptyState title={t("trk.empty")} description={t("trk.emptyDesc")} />
      ) : (
        <Table head={[t("trk.occurredAt"), t("trk.shipment"), t("trk.code"), t("shp.description"), t("common.status")]}>
          {events.map((e) => (
            <tr key={e.id}>
              <Td className="text-xs whitespace-nowrap text-gray-600">{formatDateTime(e.occurredAt, locale)}</Td>
              <Td>
                <Link href={`/app/shipments/${e.shipment.id}`} className="text-navy-900 font-mono hover:underline">
                  {e.shipment.reference}
                </Link>
              </Td>
              <Td>{t.has(`trk.codes.${e.code}`) ? t(`trk.codes.${e.code}`) : e.code}</Td>
              <Td>{e.description ?? t("common.none")}</Td>
              <Td>
                <Badge tone={statusTone(e.shipment.status)}>{t(`status.${e.shipment.status}`)}</Badge>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
