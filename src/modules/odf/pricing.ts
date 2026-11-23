export type TariffValues = {
  currency: string;
  baseFee: number;
  perKm: number;
  minimumFee: number;
  stevedoreFee: number;
  waybillFee: number;
  insuranceRatePct: number;
};

export type PriceInput = {
  distanceKm: number;
  stevedores: number;
  waybill: boolean;
  insurance: boolean;
  declaredValue: number | null;
};

export type PriceBreakdown = {
  currency: string;
  distanceKm: number;
  freight: number;
  stevedores: number;
  waybill: number;
  insurance: number;
  total: number;
};

const money = (v: number) => Math.round(v * 100) / 100;

/** Preço tabelado (sem leilão): max(mínimo, base + km × tarifa) + extras. Puro e determinístico. */
export function quoteFreight(t: TariffValues, i: PriceInput): PriceBreakdown {
  const freight = money(Math.max(t.minimumFee, t.baseFee + t.perKm * i.distanceKm));
  const stevedores = money(Math.max(0, i.stevedores) * t.stevedoreFee);
  const waybill = i.waybill ? money(t.waybillFee) : 0;
  const insurance = i.insurance && i.declaredValue ? money((i.declaredValue * t.insuranceRatePct) / 100) : 0;
  return {
    currency: t.currency,
    distanceKm: i.distanceKm,
    freight,
    stevedores,
    waybill,
    insurance,
    total: money(freight + stevedores + waybill + insurance),
  };
}

/** Valor que cabe ao prestador (frete + estiva); o seguro e a guia não são receita do motorista. */
export function providerAmount(b: PriceBreakdown): number {
  return money(b.freight + b.stevedores);
}

export function toTariffValues(t: {
  currency: string;
  baseFee: unknown;
  perKm: unknown;
  minimumFee: unknown;
  stevedoreFee: unknown;
  waybillFee: unknown;
  insuranceRatePct: unknown;
}): TariffValues {
  return {
    currency: t.currency,
    baseFee: Number(t.baseFee),
    perKm: Number(t.perKm),
    minimumFee: Number(t.minimumFee),
    stevedoreFee: Number(t.stevedoreFee),
    waybillFee: Number(t.waybillFee),
    insuranceRatePct: Number(t.insuranceRatePct),
  };
}
