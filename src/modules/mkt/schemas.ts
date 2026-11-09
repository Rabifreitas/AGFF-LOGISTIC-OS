import { z } from "zod";

const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const PARTNER_TYPES = [
  "TRANSPORTER",
  "FREIGHT_FORWARDER",
  "CUSTOMS_BROKER",
  "WAREHOUSE",
  "SUPPLIER",
  "CUSTOMER",
  "OTHER",
] as const;

export const partnerSchema = z.object({
  type: z.enum(PARTNER_TYPES),
  name: z.string().trim().min(2, "validation.required").max(200),
  nif: optionalText(20),
  country: z.string().trim().length(2).toUpperCase(),
  email: optionalText(200),
  phone: optionalText(40),
  notes: optionalText(2000),
});
export type PartnerInput = z.infer<typeof partnerSchema>;

export const VERIFICATION_KINDS = [
  "COMMERCIAL_REGISTRY",
  "TAX_CERTIFICATE",
  "INSURANCE",
  "TRANSPORT_LICENSE",
  "OTHER",
] as const;

export const verificationSchema = z.object({
  kind: z.enum(VERIFICATION_KINDS),
  expiresAt: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : null))
    .refine((d) => d === null || !Number.isNaN(d.getTime()), "validation.date"),
  notes: optionalText(1000),
});
export type VerificationInput = z.infer<typeof verificationSchema>;
