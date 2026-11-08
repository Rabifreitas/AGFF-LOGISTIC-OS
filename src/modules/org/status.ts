import type { OrganizationStatus } from "@prisma/client";

export type OrganizationTransition = "approve" | "reject" | "suspend" | "reactivate";

const TRANSITIONS: Record<OrganizationTransition, { from: OrganizationStatus[]; to: OrganizationStatus }> = {
  approve: { from: ["PENDING_APPROVAL", "REJECTED"], to: "ACTIVE" },
  reject: { from: ["PENDING_APPROVAL"], to: "REJECTED" },
  suspend: { from: ["ACTIVE"], to: "SUSPENDED" },
  reactivate: { from: ["SUSPENDED"], to: "ACTIVE" },
};

export function canTransition(from: OrganizationStatus, transition: OrganizationTransition): boolean {
  return TRANSITIONS[transition].from.includes(from);
}

export function nextStatus(from: OrganizationStatus, transition: OrganizationTransition): OrganizationStatus | null {
  return canTransition(from, transition) ? TRANSITIONS[transition].to : null;
}

export function availableTransitions(from: OrganizationStatus): OrganizationTransition[] {
  return (Object.keys(TRANSITIONS) as OrganizationTransition[]).filter((t) => canTransition(from, t));
}
