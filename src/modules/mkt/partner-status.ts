import type { PartnerStatus } from "@prisma/client";

export type PartnerTransition = "submit" | "verify" | "reject" | "suspend" | "reactivate";

const TRANSITIONS: Record<PartnerTransition, { from: readonly PartnerStatus[]; to: PartnerStatus }> = {
  submit: { from: ["DRAFT", "REJECTED"], to: "PENDING_VERIFICATION" },
  verify: { from: ["PENDING_VERIFICATION"], to: "VERIFIED" },
  reject: { from: ["PENDING_VERIFICATION"], to: "REJECTED" },
  suspend: { from: ["VERIFIED"], to: "SUSPENDED" },
  reactivate: { from: ["SUSPENDED"], to: "VERIFIED" },
};

export const PARTNER_TRANSITIONS = Object.keys(TRANSITIONS) as PartnerTransition[];

export function isPartnerTransition(v: string): v is PartnerTransition {
  return v in TRANSITIONS;
}

export function nextPartnerStatus(from: PartnerStatus, t: PartnerTransition): PartnerStatus | null {
  return TRANSITIONS[t].from.includes(from) ? TRANSITIONS[t].to : null;
}

export function availablePartnerTransitions(from: PartnerStatus): PartnerTransition[] {
  return PARTNER_TRANSITIONS.filter((t) => nextPartnerStatus(from, t) !== null);
}

/** Só parceiros verificados podem ser atribuídos como transportador de uma expedição reservada. */
/** Há pelo menos uma verificação aprovada e ainda dentro da validade. */
export function hasValidVerification(verifications: { status: string; expiresAt: Date | null }[], now = new Date()) {
  return verifications.some((v) => v.status === "APPROVED" && (!v.expiresAt || v.expiresAt > now));
}

/** Tipos de parceiro que podem executar transporte (transportador contratado ou de uma perna). */
export const CARRIER_TYPES: readonly string[] = [
  "TRANSPORTER",
  "FREIGHT_FORWARDER",
  "SHIPPING_LINE",
  "AIRLINE",
  "RAIL_OPERATOR",
  "BARGE_OPERATOR",
  "COURIER",
  "HEAVY_LIFT",
];

/** Modos assumidos quando o parceiro ainda não declarou os seus modos. */
const DEFAULT_MODES: Record<string, readonly string[]> = {
  TRANSPORTER: ["ROAD"],
  SHIPPING_LINE: ["SEA", "COASTAL"],
  AIRLINE: ["AIR"],
  RAIL_OPERATOR: ["RAIL"],
  BARGE_OPERATOR: ["INLAND_WATERWAY", "COASTAL"],
  COURIER: ["ROAD", "AIR"],
  HEAVY_LIFT: ["ROAD"],
};

export function isCarrierType(type: string) {
  return CARRIER_TYPES.includes(type);
}

/** Transitários organizam qualquer modo; os restantes operam os modos declarados (ou os do tipo). */
export function partnerOperatesMode(p: { type: string; modes?: readonly string[] | null }, mode: string) {
  if (p.type === "FREIGHT_FORWARDER") return true;
  const modes = p.modes && p.modes.length > 0 ? p.modes : (DEFAULT_MODES[p.type] ?? []);
  return modes.includes(mode);
}

export function canBeBookedAsCarrier(
  p: { status: PartnerStatus; type: string; modes?: readonly string[] | null },
  mode?: string,
) {
  return p.status === "VERIFIED" && isCarrierType(p.type) && (mode === undefined || partnerOperatesMode(p, mode));
}
