import type { ShipmentStatus } from "@prisma/client";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, Table, Td, statusTone } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { hasPermission } from "@/modules/iam/rbac";
import { requirePagePermission } from "@/modules/iam/session-context";
import { listShipments } from "@/modules/shp/services/shipment.service";
import { ShipmentForm } from "./forms";
import { shipmentFormOptions } from "./options";

export const metadata = { title: "Expedições" };

const STATUSES: ShipmentStatus[] = [
  "DRAFT",
  "REQUESTED",
  "QUOTED",
  "BOOKED",
  "IN_TRANSIT",
  "AT_CUSTOMS",
  "DELIVERED",
  "CANCELLED",
];

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const ctx = await requirePagePermission("tms.shipments.read");
  const t = await getTranslations();
  const locale = await getLocale();
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const q = sp.q?.trim().slice(0, 40) || undefined;
  const canManage = hasPermission(ctx, "tms.shipments.manage");
  const [shipments, options] = await Promise.all([
    listShipments(ctx, { status, q }),
    canManage ? shipmentFormOptions(ctx) : Promise.resolve(null),
  ]);
  const route = (stops: { type: string; city: string | null; country: string }[]) => {
    const from = stops.find((s) => s.type === "PICKUP");
    const to = [...stops].reverse().find((s) => s.type === "DELIVERY");
    const label = (s?: { city: string | null; country: string }) => (s ? (s.city ?? s.country) : "?");
    return stops.length ? `${label(from)} → ${label(to)}` : t("common.none");
  };

  return (
    <>
      <PageHeader title={t("shp.title")} description={t("shp.desc")} />
      {options && (
        <Card className="mb-6">
          <h2 className="text-navy-900 mb-4 font-semibold">{t("shp.new")}</h2>
          <ShipmentForm {...options} />
        </Card>
      )}
      <form className="mb-4 flex flex-wrap items-center gap-2 text-sm" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("shp.search")}
          aria-label={t("common.search")}
          className="rounded-md border border-gray-300 px-3 py-1.5"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          aria-label={t("common.status")}
          className="rounded-md border border-gray-300 px-3 py-1.5"
        >
          <option value="">{t("common.all")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
        <button className="bg-navy-900 rounded-md px-3 py-1.5 text-white">{t("common.filter")}</button>
      </form>
      {shipments.length === 0 ? (
        <EmptyState title={t("shp.empty")} description={t("shp.emptyDesc")} />
      ) : (
        <Table
          head={[
            t("shp.reference"),
            t("shp.route"),
            t("shp.mode"),
            t("shp.carrier"),
            t("shp.plannedDeliveryAt"),
            t("common.status"),
          ]}
        >
          {shipments.map((s) => (
            <tr key={s.id}>
              <Td>
                <Link href={`/app/shipments/${s.id}`} className="text-navy-900 font-mono font-medium hover:underline">
                  {s.reference}
                </Link>
              </Td>
              <Td>{route(s.stops)}</Td>
              <Td>{t(`shp.modes.${s.mode}`)}</Td>
              <Td>{s.carrierPartner?.name ?? t("common.none")}</Td>
              <Td className="text-xs text-gray-600">{formatDateTime(s.plannedDeliveryAt, locale)}</Td>
              <Td>
                <Badge tone={statusTone(s.status)}>{t(`status.${s.status}`)}</Badge>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
