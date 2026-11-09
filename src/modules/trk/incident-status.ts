import type { IncidentStatus } from "@prisma/client";

export type IncidentTransition = "investigate" | "resolve" | "close" | "reopen";

const TRANSITIONS: Record<IncidentTransition, { from: readonly IncidentStatus[]; to: IncidentStatus }> = {
  investigate: { from: ["OPEN"], to: "INVESTIGATING" },
  resolve: { from: ["OPEN", "INVESTIGATING"], to: "RESOLVED" },
  close: { from: ["RESOLVED"], to: "CLOSED" },
  reopen: { from: ["RESOLVED"], to: "OPEN" },
};

export const INCIDENT_TRANSITIONS = Object.keys(TRANSITIONS) as IncidentTransition[];

export function isIncidentTransition(v: string): v is IncidentTransition {
  return v in TRANSITIONS;
}

export function nextIncidentStatus(from: IncidentStatus, t: IncidentTransition): IncidentStatus | null {
  return TRANSITIONS[t].from.includes(from) ? TRANSITIONS[t].to : null;
}

export function availableIncidentTransitions(from: IncidentStatus): IncidentTransition[] {
  return INCIDENT_TRANSITIONS.filter((t) => nextIncidentStatus(from, t) !== null);
}
