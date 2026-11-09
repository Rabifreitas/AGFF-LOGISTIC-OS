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

export function canBeBookedAsCarrier(p: { status: PartnerStatus; type: string }) {
  return p.status === "VERIFIED" && (p.type === "TRANSPORTER" || p.type === "FREIGHT_FORWARDER");
}
