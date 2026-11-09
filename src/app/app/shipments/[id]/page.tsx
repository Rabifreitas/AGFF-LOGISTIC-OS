import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TransitionButtons } from "@/components/transition-buttons";
import { Badge, Card, PageHeader, Table, Td, statusTone } from "@/components/ui";
import { isAppError } from "@/lib/errors";
import { formatDateTime, toLocalDateTimeInput } from "@/lib/utils";
import { hasPermission } from "@/modules/iam/rbac";
import { requirePagePermission } from "@/modules/iam/session-context";
import { itemRowAction, stopRowAction, transitionShipmentAction } from "@/modules/shp/actions";
import { getShipment } from "@/modules/shp/services/shipment.service";
import { availableShipmentTransitions, isShipmentEditable } from "@/modules/shp/shipment-status";
import { availableIncidentTransitions } from "@/modules/trk/incident-status";
import { transitionIncidentAction } from "@/modules/trk/actions";
import { IncidentForm, ItemForm, ShipmentForm, StopForm, TrackingEventForm } from "../forms";
import { shipmentFormOptions } from "../options";

export default async function ShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission("tms.shipments.read");
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const s = await getShipment(ctx, id).catch((e) => {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const canManage = hasPermission(ctx, "tms.shipments.manage");
  const editable = canManage && isShipmentEditable(s.status);
  const canTrack = hasPermission(ctx, "trk.events.create") && ["BOOKED", "IN_TRANSIT", "AT_CUSTOMS"].includes(s.status);
  const canSeeEvents = hasPermission(ctx, "trk.events.read");
  const canSeeIncidents = hasPermission(ctx, "incidents.read");
  const canManageIncidents = hasPermission(ctx, "incidents.manage");
  const options = editable ? await shipmentFormOptions(ctx) : null;
  const totalWeight = s.items.reduce((a, i) => a + Number(i.weightKg ?? 0), 0);
  const totalVolume = s.items.reduce((a, i) => a + Number(i.volumeM3 ?? 0), 0);
  const back = `/app/shipments/${s.id}`;

  const summary: [string, string][] = [
    [t("shp.mode"), t(`shp.modes.${s.mode}`)],
    [t("shp.incoterm"), s.incoterm ?? t("common.none")],
    [t("shp.customer"), s.customerPartner?.name ?? t("common.none")],
    [t("shp.carrier"), s.carrierPartner?.name ?? t("common.none")],
    [t("shp.costCenter"), s.costCenter ? `${s.costCenter.code} — ${s.costCenter.name}` : t("common.none")],
    [t("shp.plannedPickupAt"), formatDateTime(s.plannedPickupAt, locale)],
    [t("shp.plannedDeliveryAt"), formatDateTime(s.plannedDeliveryAt, locale)],
    [
      t("shp.declaredValue"),
      s.declaredValue ? `${Number(s.declaredValue).toLocaleString(locale)} ${s.currency}` : t("common.none"),
    ],
  ];

  return (
    <>
      <Link href="/app/shipments" className="text-sm text-gray-600 hover:underline">
        ← {t("common.back")}
      </Link>
      <PageHeader
        title={s.reference}
        description={`${t("shp.createdAt")} ${formatDateTime(s.createdAt, locale)}`}
        actions={<Badge tone={statusTone(s.status)}>{t(`status.${s.status}`)}</Badge>}
      />
      {canManage && (
        <div className="mb-6">
          <TransitionButtons
            action={transitionShipmentAction}
            fields={{ id: s.id }}
            transitions={availableShipmentTransitions(s.status)}
            labelPrefix="shp.transition"
            danger={["cancel"]}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="text-navy-900 mb-4 font-semibold">{t("common.details")}</h2>
            {options ? (
              <ShipmentForm
                {...options}
                shipment={{
                  id: s.id,
                  mode: s.mode,
                  incoterm: s.incoterm,
                  customerPartnerId: s.customerPartnerId,
                  carrierPartnerId: s.carrierPartnerId,
                  costCenterId: s.costCenterId,
                  plannedPickupAt: toLocalDateTimeInput(s.plannedPickupAt),
                  plannedDeliveryAt: toLocalDateTimeInput(s.plannedDeliveryAt),
                  currency: s.currency,
                  declaredValue: s.declaredValue?.toString() ?? null,
                  notes: s.notes,
                }}
              />
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {summary.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-gray-500">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                {s.notes && <p className="mt-4 text-sm whitespace-pre-line text-gray-700">{s.notes}</p>}
                {canManage && <p className="mt-4 text-xs text-gray-500">{t("shp.lockedHint")}</p>}
              </>
            )}
          </Card>

          <Card>
            <h2 className="text-navy-900 mb-4 font-semibold">{t("shp.stops")}</h2>
            {s.stops.length === 0 ? (
              <p className="mb-4 text-sm text-gray-500">{t("shp.noStops")}</p>
            ) : (
              <div className="mb-4">
                <Table
                  head={[
                    t("shp.sequence"),
                    t("common.type"),
                    t("shp.address"),
                    t("shp.plannedAt"),
                    editable ? "" : null,
                  ].filter((h) => h !== null)}
                >
                  {s.stops.map((st, i) => (
                    <tr key={st.id}>
                      <Td>{i + 1}</Td>
                      <Td>{t(`shp.stopType.${st.type}`)}</Td>
                      <Td>
                        {st.name && <span className="font-medium">{st.name} · </span>}
                        {st.address}
                        {st.city && `, ${st.city}`} ({st.country})
                      </Td>
                      <Td className="text-xs text-gray-600">{formatDateTime(st.plannedAt, locale)}</Td>
                      {editable && (
                        <Td>
                          <TransitionButtons
                            action={stopRowAction}
                            fields={{ id: st.id, shipmentId: s.id }}
                            transitions={[
                              ...(i > 0 ? ["up"] : []),
                              ...(i < s.stops.length - 1 ? ["down"] : []),
                              "remove",
                            ]}
                            labelPrefix="common"
                            danger={["remove"]}
                            size="sm"
                          />
                        </Td>
                      )}
                    </tr>
                  ))}
                </Table>
              </div>
            )}
            {editable && <StopForm shipmentId={s.id} />}
          </Card>

          <Card>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-navy-900 font-semibold">{t("shp.items")}</h2>
              {s.items.length > 0 && (
                <span className="text-xs text-gray-600">
                  {t("shp.totals", {
                    weight: totalWeight.toLocaleString(locale),
                    volume: totalVolume.toLocaleString(locale),
                  })}
                </span>
              )}
            </div>
            {s.items.length === 0 ? (
              <p className="mb-4 text-sm text-gray-500">{t("shp.noItems")}</p>
            ) : (
              <div className="mb-4">
                <Table
                  head={[
                    t("shp.description"),
                    t("shp.quantity"),
                    t("shp.weightKg"),
                    t("shp.volumeM3"),
                    t("shp.hsCode"),
                    editable ? "" : null,
                  ].filter((h) => h !== null)}
                >
                  {s.items.map((it) => (
                    <tr key={it.id}>
                      <Td>
                        {it.description}
                        {it.dangerousGoods && (
                          <span className="ml-2">
                            <Badge tone="red">{t("shp.dangerousGoods")}</Badge>
                          </span>
                        )}
                      </Td>
                      <Td>
                        {Number(it.quantity).toLocaleString(locale)} {it.unit}
                      </Td>
                      <Td>{it.weightKg ? Number(it.weightKg).toLocaleString(locale) : t("common.none")}</Td>
                      <Td>{it.volumeM3 ? Number(it.volumeM3).toLocaleString(locale) : t("common.none")}</Td>
                      <Td>{it.hsCode ?? t("common.none")}</Td>
                      {editable && (
                        <Td>
                          <TransitionButtons
                            action={itemRowAction}
                            fields={{ id: it.id, shipmentId: s.id }}
                            transitions={["remove"]}
                            labelPrefix="common"
                            danger={["remove"]}
                            size="sm"
                          />
                        </Td>
                      )}
                    </tr>
                  ))}
                </Table>
              </div>
            )}
            {editable && <ItemForm shipmentId={s.id} />}
          </Card>
        </div>

        <div className="space-y-6">
          {canSeeEvents && (
            <Card>
              <h2 className="text-navy-900 mb-4 font-semibold">{t("trk.timeline")}</h2>
              {canTrack && (
                <div className="mb-6">
                  <TrackingEventForm shipmentId={s.id} />
                </div>
              )}
              {s.trackingEvents.length === 0 ? (
                <p className="text-sm text-gray-500">{t("trk.empty")}</p>
              ) : (
                <ol className="border-gold-500 space-y-4 border-l-2 pl-4">
                  {s.trackingEvents.map((e) => (
                    <li key={e.id}>
                      <p className="text-navy-900 text-sm font-medium">
                        {t.has(`trk.codes.${e.code}`) ? t(`trk.codes.${e.code}`) : e.code}
                      </p>
                      <p className="text-xs text-gray-500">{formatDateTime(e.occurredAt, locale)}</p>
                      {e.description && <p className="mt-1 text-sm text-gray-700">{e.description}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          )}

          {canSeeIncidents && (
            <Card>
              <h2 className="text-navy-900 mb-4 font-semibold">{t("incidents.title")}</h2>
              {s.incidents.length === 0 ? (
                <p className="mb-4 text-sm text-gray-500">{t("incidents.empty")}</p>
              ) : (
                <ul className="mb-4 space-y-3">
                  {s.incidents.map((inc) => (
                    <li key={inc.id} className="rounded-md border border-gray-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{inc.title}</span>
                        <Badge tone={statusTone(inc.status)}>{t(`status.${inc.status}`)}</Badge>
                      </div>
                      <p className="mb-2 text-xs text-gray-500">
                        {t(`incidents.severities.${inc.severity}`)} · {formatDateTime(inc.createdAt, locale)}
                      </p>
                      {inc.resolution && <p className="mb-2 text-sm text-gray-700">{inc.resolution}</p>}
                      {canManageIncidents && (
                        <TransitionButtons
                          action={transitionIncidentAction}
                          fields={{ id: inc.id, back }}
                          transitions={availableIncidentTransitions(inc.status)}
                          labelPrefix="incidents.transition"
                          reasonFor={["resolve"]}
                          size="sm"
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canManageIncidents && <IncidentForm shipmentId={s.id} />}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
