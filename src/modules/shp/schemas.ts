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

export const TRANSPORT_MODES = ["ROAD", "SEA", "AIR", "RAIL", "MULTIMODAL"] as const;
export const STOP_TYPES = ["PICKUP", "DELIVERY", "WAYPOINT", "CUSTOMS"] as const;
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

export const itemSchema = z.object({
  description: z.string().trim().min(2, "validation.required").max(300),
  quantity: z.coerce.number().positive("validation.positive"),
  unit: z.string().trim().min(1).max(10).default("UN"),
  weightKg: optionalDecimal,
  volumeM3: optionalDecimal,
  hsCode: optionalText(20),
  dangerousGoods: z.coerce.boolean().default(false),
});
export type ItemInput = z.infer<typeof itemSchema>;
