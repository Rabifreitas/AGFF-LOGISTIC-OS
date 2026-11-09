"use server";

import type { ActionState } from "@/modules/iam/action-result";
import { formId, runAction, runFormAction } from "@/modules/iam/form-action";
import { isIncidentTransition } from "./incident-status";
import { incidentSchema, trackingEventSchema } from "./schemas";
import { openIncident, transitionIncident } from "./services/incident.service";
import { recordTrackingEvent } from "./services/tracking.service";

export async function recordTrackingEventAction(_: ActionState, f: FormData) {
  const id = formId(f, "shipmentId");
  return runFormAction(f, trackingEventSchema, (ctx, d) => recordTrackingEvent(ctx, id, d), `/app/shipments/${id}`);
}

export async function openIncidentAction(_: ActionState, f: FormData) {
  const back = String(f.get("back") || "/app/incidents");
  return runFormAction(f, incidentSchema, openIncident, back.startsWith("/app/") ? back : "/app/incidents");
}

export async function transitionIncidentAction(_: ActionState, f: FormData) {
  const t = String(f.get("transition"));
  if (!isIncidentTransition(t)) return { ok: false, error: "errors.invalidState" };
  const back = String(f.get("back") || "/app/incidents");
  return runAction(
    (ctx) => transitionIncident(ctx, formId(f), t, String(f.get("reason") ?? "")),
    back.startsWith("/app/") ? back : "/app/incidents",
  );
}
