import { z } from "zod";
import { validatePasswordPolicy } from "@/lib/password";
import { ROLE_KEYS } from "./permissions";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "validation.email" }));

export const passwordSchema = z.string().superRefine((value, ctx) => {
  for (const issue of validatePasswordPolicy(value)) {
    ctx.addIssue({ code: "custom", message: `validation.password.${issue}` });
  }
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "validation.required"),
});

export const nifSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6,20}$/, "validation.nif");

export const registerSchema = z.object({
  companyName: z.string().trim().min(2, "validation.required").max(200),
  legalName: z.string().trim().min(2, "validation.required").max(200),
  nif: nifSchema,
  organizationType: z.enum([
    "SHIPPER",
    "TRANSPORTER",
    "FREIGHT_FORWARDER",
    "CUSTOMS_BROKER",
    "WAREHOUSE",
    "SUPPLIER",
    "OTHER",
  ]),
  country: z.string().trim().length(2).toUpperCase().default("AO"),
  currency: z.string().trim().length(3).toUpperCase().default("AOA"),
  companyEmail: emailSchema,
  companyPhone: z.string().trim().max(40).optional().or(z.literal("")),
  adminName: z.string().trim().min(2, "validation.required").max(120),
  adminEmail: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal(true, { message: "validation.acceptTerms" }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const inviteSchema = z.object({
  email: emailSchema,
  roleKey: z.enum(ROLE_KEYS),
});

export const acceptInviteNewUserSchema = z.object({
  name: z.string().trim().min(2, "validation.required").max(120),
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    message: "validation.passwordMismatch",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1), password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    message: "validation.passwordMismatch",
    path: ["confirmPassword"],
  });
