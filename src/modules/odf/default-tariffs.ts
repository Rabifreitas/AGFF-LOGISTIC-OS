import type { PrismaClient, VehicleCategory } from "@prisma/client";

/** Valores de referência (AOA) para arranque; a AGFF revê-os em /admin/freight-tariffs. */
export const DEFAULT_TARIFFS: Record<
  VehicleCategory,
  {
    baseFee: number;
    perKm: number;
    minimumFee: number;
    stevedoreFee: number;
    waybillFee: number;
    insuranceRatePct: number;
  }
> = {
  PICKUP_1_5T: {
    baseFee: 15000,
    perKm: 350,
    minimumFee: 20000,
    stevedoreFee: 5000,
    waybillFee: 2500,
    insuranceRatePct: 0.35,
  },
  LIGHT_TRUCK_5T: {
    baseFee: 30000,
    perKm: 600,
    minimumFee: 40000,
    stevedoreFee: 6000,
    waybillFee: 2500,
    insuranceRatePct: 0.35,
  },
  CONTAINER_TRUCK: {
    baseFee: 60000,
    perKm: 1500,
    minimumFee: 90000,
    stevedoreFee: 7500,
    waybillFee: 2500,
    insuranceRatePct: 0.35,
  },
  TIPPER_BULK: {
    baseFee: 45000,
    perKm: 1100,
    minimumFee: 70000,
    stevedoreFee: 6000,
    waybillFee: 2500,
    insuranceRatePct: 0.35,
  },
  REEFER_10T: {
    baseFee: 55000,
    perKm: 1300,
    minimumFee: 85000,
    stevedoreFee: 7500,
    waybillFee: 2500,
    insuranceRatePct: 0.5,
  },
};

/** Cria as tarifas em falta sem alterar as existentes. */
export async function ensureDefaultTariffs(db: PrismaClient) {
  for (const [category, values] of Object.entries(DEFAULT_TARIFFS)) {
    await db.freightTariff.upsert({
      where: { category: category as VehicleCategory },
      create: { category: category as VehicleCategory, currency: "AOA", ...values },
      update: {},
    });
  }
}
