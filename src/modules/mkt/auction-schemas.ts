import { z } from "zod";
import { parseLocalDateTime } from "@/lib/utils";
import { LOGISTICS_SERVICES, multiEnum, TRANSPORT_MODES } from "@/modules/shp/schemas";
import { PROVIDER_REVIEW_TRANSITIONS } from "./auction-rules";

const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const date = (required: boolean) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) {
        if (required) ctx.addIssue({ code: "custom", message: "validation.required" });
        return required ? z.NEVER : null;
      }
      const d = parseLocalDateTime(v);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: "custom", message: "validation.date" });
        return z.NEVER;
      }
      return d;
    });

export const AUCTION_CURRENCIES = ["USD", "AOA", "EUR"] as const;

export const auctionSchema = z.object({
  shipmentId: z.string().trim().min(1).max(40),
  closesAt: date(true).pipe(z.date()),
  modes: multiEnum(TRANSPORT_MODES).refine((v) => v.length > 0, "mkt.auction.needsMode"),
  services: multiEnum(LOGISTICS_SERVICES),
  currency: z.enum(AUCTION_CURRENCIES),
  publicNotes: optionalText(1000),
});
export type AuctionInput = z.infer<typeof auctionSchema>;

export const bidSchema = z.object({
  amount: z.coerce.number().positive("validation.positive").max(1e12),
  mode: z.enum(TRANSPORT_MODES),
  transitDays: z.coerce.number().int().min(0).max(365),
  validUntil: date(false),
  notes: optionalText(1000),
});
export type BidInput = z.infer<typeof bidSchema>;

export const providerProfileSchema = z.object({
  modes: multiEnum(TRANSPORT_MODES),
  services: multiEnum(LOGISTICS_SERVICES),
  countries: z
    .string()
    .optional()
    .transform((v) => [
      ...new Set(
        (v ?? "")
          .split(/[\s,;]+/)
          .map((c) => c.trim().toUpperCase())
          .filter((c) => /^[A-Z]{2}$/.test(c)),
      ),
    ]),
  description: optionalText(2000),
});
export type ProviderProfileInput = z.infer<typeof providerProfileSchema>;

export const providerReviewSchema = z.object({
  decision: z.enum(PROVIDER_REVIEW_TRANSITIONS),
  validUntil: date(false),
  reason: optionalText(500),
});
export type ProviderReviewInput = z.infer<typeof providerReviewSchema>;
