import { z } from "zod";

export const DOCUMENT_TYPES = [
  "BILL_OF_LADING",
  "AIR_WAYBILL",
  "COMMERCIAL_INVOICE",
  "PACKING_LIST",
  "CUSTOMS_DECLARATION",
  "CERTIFICATE_OF_ORIGIN",
  "DELIVERY_NOTE",
  "INSURANCE",
  "LICENSE",
  "CONTRACT",
  "OTHER",
] as const;

export const documentSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  title: z.string().trim().min(2, "validation.required").max(200),
  expiresAt: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : null))
    .refine((d) => d === null || !Number.isNaN(d.getTime()), "validation.date"),
  shipmentId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
});
export type DocumentInput = z.infer<typeof documentSchema>;

export type UploadedFile = { name: string; bytes: Buffer };
