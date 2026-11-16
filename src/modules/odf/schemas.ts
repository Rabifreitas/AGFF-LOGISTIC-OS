import { z } from "zod";
import { isValidLatLng } from "./geo";
import { PLACE_KEYS, PLACES, VEHICLE_CATEGORIES, VEHICLE_STATUSES, type PlaceKey } from "./rules";

const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const decimal = (opts: { optional?: boolean } = {}) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v || !v.trim()) {
        if (opts.optional) return null;
        ctx.addIssue({ code: "custom", message: "validation.required" });
        return z.NEVER;
      }
      const n = Number(v.replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        ctx.addIssue({ code: "custom", message: "validation.nonNegative" });
        return z.NEVER;
      }
      return n;
    });

const coordinate = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? Number(v.replace(",", ".")) : null));

export type ResolvedPoint = { label: string; address: string | null; lat: number; lng: number };

/** Ponto de recolha/entrega: um local de referência, a posição do telemóvel ("GPS") ou coordenadas manuais. */
function resolvePoint(
  place: string,
  lat: number | null,
  lng: number | null,
  address: string | null,
  ctx: z.RefinementCtx,
  path: string,
): ResolvedPoint | null {
  if (PLACE_KEYS.includes(place as PlaceKey)) {
    const p = PLACES[place as PlaceKey];
    return { label: place, address, lat: p.lat, lng: p.lng };
  }
  if ((place === "GPS" || place === "CUSTOM") && lat !== null && lng !== null && isValidLatLng({ lat, lng })) {
    return { label: address ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`, address, lat, lng };
  }
  ctx.addIssue({ code: "custom", message: "odf.validation.point", path: [path] });
  return null;
}

export const freightRequestSchema = z
  .object({
    category: z.enum(VEHICLE_CATEGORIES),
    pickupPlace: z.string().default(""),
    pickupLat: coordinate,
    pickupLng: coordinate,
    pickupAddress: optionalText(300),
    dropoffPlace: z.string().default(""),
    dropoffLat: coordinate,
    dropoffLng: coordinate,
    dropoffAddress: optionalText(300),
    cargoDescription: z.string().trim().min(2, "validation.required").max(300),
    weightKg: decimal({ optional: true }),
    containerType: optionalText(40),
    stevedores: z.coerce.number().int().min(0).max(20).default(0),
    waybill: z.coerce.boolean().default(false),
    insurance: z.coerce.boolean().default(false),
    declaredValue: decimal({ optional: true }),
    scheduledFor: z
      .string()
      .optional()
      .transform((v) => (v ? new Date(v) : null))
      .refine((d) => d === null || !Number.isNaN(d.getTime()), "validation.invalidDate"),
  })
  .transform((d, ctx) => {
    const pickup = resolvePoint(d.pickupPlace, d.pickupLat, d.pickupLng, d.pickupAddress, ctx, "pickupPlace");
    const dropoff = resolvePoint(d.dropoffPlace, d.dropoffLat, d.dropoffLng, d.dropoffAddress, ctx, "dropoffPlace");
    if (d.insurance && !d.declaredValue) {
      ctx.addIssue({ code: "custom", message: "odf.validation.declaredValue", path: ["declaredValue"] });
    }
    if (!pickup || !dropoff) return z.NEVER;
    if (pickup.lat === dropoff.lat && pickup.lng === dropoff.lng) {
      ctx.addIssue({ code: "custom", message: "odf.validation.samePoint", path: ["dropoffPlace"] });
      return z.NEVER;
    }
    return {
      category: d.category,
      pickup,
      dropoff,
      cargoDescription: d.cargoDescription,
      weightKg: d.weightKg,
      containerType: d.containerType,
      stevedores: d.stevedores,
      waybill: d.waybill,
      insurance: d.insurance,
      declaredValue: d.declaredValue,
      scheduledFor: d.scheduledFor,
    };
  });
export type FreightRequestInput = z.output<typeof freightRequestSchema>;

const requiredDecimal = () => decimal().transform((v) => v ?? 0);

export const tariffSchema = z.object({
  category: z.enum(VEHICLE_CATEGORIES),
  baseFee: requiredDecimal(),
  perKm: requiredDecimal(),
  minimumFee: requiredDecimal(),
  stevedoreFee: requiredDecimal(),
  waybillFee: requiredDecimal(),
  insuranceRatePct: requiredDecimal().refine((v) => v <= 100, "validation.nonNegative"),
  active: z.coerce.boolean().default(false),
});
export type TariffInput = z.output<typeof tariffSchema>;

export const vehicleSchema = z.object({
  plate: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, "validation.required")
    .max(20)
    .regex(/^[A-Z0-9 -]+$/, "odf.validation.plate"),
  category: z.enum(VEHICLE_CATEGORIES),
  capacityKg: decimal({ optional: true }),
  description: optionalText(200),
  status: z.enum(VEHICLE_STATUSES).default("ACTIVE"),
  driverUserId: optionalText(40),
});
export type VehicleInput = z.output<typeof vehicleSchema>;

export const locationSchema = z
  .object({ lat: z.coerce.number(), lng: z.coerce.number() })
  .refine(isValidLatLng, "odf.validation.point");
export type LocationInput = z.output<typeof locationSchema>;

export const ratingSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: optionalText(500),
});
export type RatingInput = z.output<typeof ratingSchema>;
