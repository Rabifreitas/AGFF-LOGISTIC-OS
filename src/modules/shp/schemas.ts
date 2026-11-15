import { z } from "zod";
import { parseLocalDateTime } from "@/lib/utils";

const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));
const optionalId = optionalText(40);
const optionalDate = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = parseLocalDateTime(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "validation.date" });
      return z.NEVER;
    }
    return d;
  });
const optionalDecimal = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "validation.nonNegative" });
      return z.NEVER;
    }
    return n;
  });

export const TRANSPORT_MODES = [
  "ROAD",
  "RAIL",
  "SEA",
  "COASTAL",
  "INLAND_WATERWAY",
  "AIR",
  "PIPELINE",
  "MULTIMODAL",
] as const;
export type TransportModeValue = (typeof TRANSPORT_MODES)[number];
export const STOP_TYPES = [
  "PICKUP",
  "DELIVERY",
  "WAYPOINT",
  "CUSTOMS",
  "PORT",
  "AIRPORT",
  "RAIL_TERMINAL",
  "RIVER_PORT",
  "WAREHOUSE",
  "TRANSSHIPMENT",
] as const;
export const LOGISTICS_SERVICES = [
  "TRANSPORT",
  "FREIGHT_FORWARDING",
  "CUSTOMS_CLEARANCE",
  "WAREHOUSING",
  "STEVEDORING",
  "PORT_HANDLING",
  "CONTAINER_DEPOT",
  "HEAVY_LIFT",
  "COLD_CHAIN",
  "LAST_MILE",
  "COURIER",
  "PACKAGING",
  "CARGO_INSURANCE",
  "INSPECTION",
  "PROJECT_CARGO",
  "DANGEROUS_GOODS",
  "SHIP_AGENCY",
] as const;
export const CARGO_TYPES = [
  "GENERAL",
  "CONTAINER",
  "DRY_BULK",
  "LIQUID_BULK",
  "BREAKBULK",
  "RORO",
  "PROJECT",
  "REEFER",
  "DANGEROUS",
  "LIVESTOCK",
] as const;
/** Modos que uma perna individual pode ter (MULTIMODAL é a soma das pernas). */
export const LEG_MODES = TRANSPORT_MODES.filter((m) => m !== "MULTIMODAL");

/** Selecção múltipla vinda de checkboxes: ausente, um valor ou vários; remove duplicados. */
export const multiEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.array(z.enum(values))])
    .optional()
    .transform((v) => [...new Set(v === undefined ? [] : Array.isArray(v) ? v : [v])] as T[number][]);
export const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const;

export const shipmentSchema = z.object({
  mode: z.enum(TRANSPORT_MODES),
  incoterm: z
    .enum(INCOTERMS)
    .or(z.literal(""))
    .optional()
    .transform((v) => v || null),
  customerPartnerId: optionalId,
  carrierPartnerId: optionalId,
  costCenterId: optionalId,
  plannedPickupAt: optionalDate,
  plannedDeliveryAt: optionalDate,
  currency: z.string().trim().length(3).toUpperCase(),
  declaredValue: optionalDecimal,
  notes: optionalText(2000),
  services: multiEnum(LOGISTICS_SERVICES),
});
export type ShipmentInput = z.infer<typeof shipmentSchema>;

export const stopSchema = z.object({
  type: z.enum(STOP_TYPES),
  name: optionalText(120),
  address: z.string().trim().min(3, "validation.required").max(300),
  city: optionalText(100),
  country: z.string().trim().length(2).toUpperCase(),
  plannedAt: optionalDate,
});
export type StopInput = z.infer<typeof stopSchema>;

const optionalTemperature = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n) || n < -100 || n > 100) {
      ctx.addIssue({ code: "custom", message: "validation.temperature" });
      return z.NEVER;
    }
    return n;
  });

export const itemSchema = z
  .object({
    description: z.string().trim().min(2, "validation.required").max(300),
    quantity: z.coerce.number().positive("validation.positive"),
    unit: z.string().trim().min(1).max(10).default("UN"),
    weightKg: optionalDecimal,
    volumeM3: optionalDecimal,
    hsCode: optionalText(20),
    dangerousGoods: z.coerce.boolean().default(false),
    cargoType: z.enum(CARGO_TYPES).default("GENERAL"),
    containerNumber: optionalText(20),
    containerType: optionalText(30),
    sealNumber: optionalText(30),
    unNumber: optionalText(10),
    imoClass: optionalText(10),
    tempMinC: optionalTemperature,
    tempMaxC: optionalTemperature,
  })
  .refine((i) => i.tempMinC === null || i.tempMaxC === null || i.tempMinC <= i.tempMaxC, {
    message: "validation.tempRange",
    path: ["tempMaxC"],
  })
  .transform((i) => ({ ...i, dangerousGoods: i.dangerousGoods || i.cargoType === "DANGEROUS" || !!i.unNumber }));
export type ItemInput = z.infer<typeof itemSchema>;

export const legSchema = z
  .object({
    mode: z.enum(LEG_MODES as unknown as [TransportModeValue, ...TransportModeValue[]]),
    carrierPartnerId: optionalId,
    origin: z.string().trim().min(2, "validation.required").max(200),
    destination: z.string().trim().min(2, "validation.required").max(200),
    equipmentType: optionalText(60),
    vehiclePlate: optionalText(20),
    vesselName: optionalText(100),
    voyageNumber: optionalText(30),
    flightNumber: optionalText(20),
    transportDocNumber: optionalText(60),
    plannedDepartureAt: optionalDate,
    plannedArrivalAt: optionalDate,
  })
  .refine((l) => !l.plannedDepartureAt || !l.plannedArrivalAt || l.plannedArrivalAt >= l.plannedDepartureAt, {
    message: "shp.arrivalBeforeDeparture",
    path: ["plannedArrivalAt"],
  });
export type LegInput = z.infer<typeof legSchema>;
