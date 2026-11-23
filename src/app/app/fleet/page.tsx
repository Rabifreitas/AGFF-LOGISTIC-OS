import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, Table, Td, statusTone } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { requirePagePermission } from "@/modules/iam/session-context";
import { formatMoney, placeLabel } from "@/modules/odf/format";
import { providerAmount, type PriceBreakdown } from "@/modules/odf/pricing";
import { listFleet, listFleetJobs } from "@/modules/odf/services/freight.service";
import { VehicleForm } from "./vehicle-form";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("fleet") };
}

export default async function FleetPage() {
  const ctx = await requirePagePermission("odf.fleet.manage");
  const t = await getTranslations();
  const locale = await getLocale();
  const [{ vehicles, drivers, profile, trust }, jobs] = await Promise.all([listFleet(ctx), listFleetJobs(ctx)]);
  const driverOptions = drivers.map((d) => ({ id: d.id, name: d.name ?? d.email }));
  const verified =
    profile?.status === "VERIFIED" && profile.modes.includes("ROAD") && profile.services.includes("TRANSPORT");
  return (
    <div className="odf">
      <PageHeader title={t("odf.fleet.title")} description={t("odf.fleet.desc")} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {verified ? (
          <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
            {t("odf.fleet.verified")}
          </span>
        ) : (
          <p className="rounded bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
            {t("odf.fleet.notVerified")}{" "}
            <Link href="/app/organization/provider" className="underline">
              →
            </Link>
          </p>
        )}
        <span className="rounded bg-[#0b192c] px-2 py-1 text-xs font-bold text-[#fece57]">
          {t("odf.trustScore")} {trust?.score ?? "—"}
        </span>
      </div>

      <Card className="mb-6">
        <h2 className="mb-3 font-bold text-[#0b192c]">{t("odf.fleet.addVehicle")}</h2>
        <VehicleForm drivers={driverOptions} />
      </Card>

      <h2 className="mb-3 font-bold text-[#0b192c]">{t("odf.fleet.vehicles")}</h2>
      {vehicles.length === 0 ? (
        <EmptyState title={t("odf.fleet.noVehicles")} description={t("odf.fleet.desc")} />
      ) : (
        <div className="mb-8 space-y-3">
          {vehicles.map((v) => (
            <Card key={v.id}>
              <div className="mb-2 flex items-center gap-3">
                <span className="font-mono font-bold">{v.plate}</span>
                <Badge tone={statusTone(v.status)}>{t(`odf.vehicleStatus.${v.status}`)}</Badge>
              </div>
              <VehicleForm
                drivers={driverOptions}
                values={{
                  id: v.id,
                  plate: v.plate,
                  category: v.category,
                  capacityKg: v.capacityKg?.toString() ?? "",
                  description: v.description ?? "",
                  status: v.status,
                  driverUserId: v.driverUserId ?? "",
                }}
              />
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-1 font-bold text-[#0b192c]">{t("odf.fleet.drivers")}</h2>
      <p className="mb-3 text-sm text-gray-500">{t("odf.fleet.driversDesc")}</p>
      {drivers.length > 0 && (
        <div className="mb-8">
          <Table head={[t("odf.driver"), t("odf.fleet.status"), t("odf.lastPosition")]}>
            {drivers.map((d) => (
              <tr key={d.id}>
                <Td>{d.name ?? d.email}</Td>
                <Td>
                  <Badge tone={d.driverPresence?.online ? "green" : "gray"}>
                    {d.driverPresence?.online ? t("odf.fleet.online") : t("odf.fleet.offline")}
                  </Badge>
                </Td>
                <Td>{formatDateTime(d.driverPresence?.locatedAt, locale)}</Td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      <h2 className="mb-3 font-bold text-[#0b192c]">{t("odf.fleet.jobs")}</h2>
      {jobs.length === 0 ? (
        <p className="text-sm text-gray-500">{t("odf.driverApp.noHistory")}</p>
      ) : (
        <Table
          head={[t("odf.reference"), t("odf.route"), t("odf.driver"), t("odf.providerAmount"), t("odf.statusLabel")]}
        >
          {jobs.map((j) => (
            <tr key={j.id}>
              <Td className="font-mono">{j.reference}</Td>
              <Td>
                {placeLabel(t, j.pickupLabel)} → {placeLabel(t, j.dropoffLabel)}
              </Td>
              <Td>
                {j.driver?.name} · <span className="font-mono">{j.vehicle?.plate}</span>
              </Td>
              <Td className="odf-data">
                {formatMoney(providerAmount(j.priceBreakdown as unknown as PriceBreakdown), j.currency, locale)}
              </Td>
              <Td>
                <Badge tone={statusTone(j.status)}>{t(`odf.status.${j.status}`)}</Badge>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
