import { z } from "zod";

const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const orgProfileSchema = z.object({
  name: z.string().trim().min(2, "validation.required").max(200),
  legalName: z.string().trim().min(2, "validation.required").max(200),
  country: z.string().trim().length(2).toUpperCase(),
  currency: z.string().trim().length(3).toUpperCase(),
  taxRegime: optionalText(),
  vatNumber: optionalText(40),
  commercialRegistry: optionalText(60),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: "validation.email" })),
  phone: optionalText(40),
  website: optionalText(200),
});

export const addressSchema = z.object({
  type: z.enum(["HEADQUARTERS", "BILLING", "OPERATIONS", "WAREHOUSE", "OTHER"]),
  line1: z.string().trim().min(2, "validation.required").max(200),
  line2: optionalText(),
  city: z.string().trim().min(2, "validation.required").max(100),
  province: optionalText(100),
  postalCode: optionalText(20),
  country: z.string().trim().length(2).toUpperCase(),
  isPrimary: z.coerce.boolean().default(false),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "validation.required").max(120),
  role: optionalText(120),
  email: optionalText(200),
  phone: optionalText(40),
  isPrimary: z.coerce.boolean().default(false),
});

export const representativeSchema = z.object({
  name: z.string().trim().min(2, "validation.required").max(120),
  position: optionalText(120),
  documentType: optionalText(40),
  documentNumber: optionalText(60),
  email: optionalText(200),
  phone: optionalText(40),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(2, "validation.required").max(120),
  code: optionalText(20),
});

export const costCenterSchema = z.object({
  code: z.string().trim().min(1, "validation.required").max(20),
  name: z.string().trim().min(2, "validation.required").max(120),
  departmentId: optionalText(40),
});

export const orgSettingsSchema = z.object({
  defaultLocale: z.enum(["pt-PT", "en"]),
  timezone: z.string().trim().min(3).max(60),
  dateFormat: z.enum(["dd/MM/yyyy", "yyyy-MM-dd", "MM/dd/yyyy"]),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),
});
export type OrgSettings = z.infer<typeof orgSettingsSchema>;

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  defaultLocale: "pt-PT",
  timezone: "Africa/Luanda",
  dateFormat: "dd/MM/yyyy",
  fiscalYearStartMonth: 1,
};
