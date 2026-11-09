import { z } from "zod";
import { parseLocalDateTime } from "@/lib/utils";
import { TRACKING_CODES } from "./tracking-codes";

const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));
const optionalCoord = (limit: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((n) => n === null || (Number.isFinite(n) && Math.abs(n) <= limit), "validation.coordinate");

export const trackingEventSchema = z.object({
  code: z.enum(TRACKING_CODES),
  description: optionalText(1000),
  occurredAt: z
    .string()
    .optional()
    .transform((v) => (v ? parseLocalDateTime(v) : new Date()))
    .refine((d) => !Number.isNaN(d.getTime()), "validation.date"),
  latitude: optionalCoord(90),
  longitude: optionalCoord(180),
});
export type TrackingEventInput = z.infer<typeof trackingEventSchema>;

export const INCIDENT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const incidentSchema = z.object({
  shipmentId: optionalText(40),
  title: z.string().trim().min(3, "validation.required").max(200),
  description: optionalText(4000),
  severity: z.enum(INCIDENT_SEVERITIES),
});
export type IncidentInput = z.infer<typeof incidentSchema>;
