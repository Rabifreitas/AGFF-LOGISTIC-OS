"use server";

import type { ActionState } from "@/modules/iam/action-result";
import { formId, runAction, runFormAction } from "@/modules/iam/form-action";
import { itemSchema, shipmentSchema, stopSchema } from "./schemas";
import * as svc from "./services/shipment.service";
import { isShipmentTransition } from "./shipment-status";

const path = (id: string) => `/app/shipments/${id}`;

export async function createShipmentAction(_: ActionState, f: FormData) {
  return runFormAction(f, shipmentSchema, svc.createShipment, "/app/shipments", "shp.created");
}

export async function updateShipmentAction(_: ActionState, f: FormData) {
  const id = formId(f);
  return runFormAction(f, shipmentSchema, (ctx, d) => svc.updateShipment(ctx, id, d), path(id));
}

export async function transitionShipmentAction(_: ActionState, f: FormData) {
  const id = formId(f);
  const t = String(f.get("transition"));
  if (!isShipmentTransition(t)) return { ok: false, error: "errors.invalidState" };
  return runAction((ctx) => svc.transitionShipment(ctx, id, t), path(id));
}

export async function addStopAction(_: ActionState, f: FormData) {
  const id = formId(f);
  return runFormAction(f, stopSchema, (ctx, d) => svc.addStop(ctx, id, d), path(id));
}

export async function addItemAction(_: ActionState, f: FormData) {
  const id = formId(f);
  return runFormAction(f, itemSchema, (ctx, d) => svc.addItem(ctx, id, d), path(id));
}

/** Botões das linhas de paragens/carga: transition = up | down | remove. */
export async function stopRowAction(_: ActionState, f: FormData) {
  const op = String(f.get("transition"));
  const stopId = formId(f);
  return runAction(
    (ctx) => (op === "remove" ? svc.removeStop(ctx, stopId) : svc.moveStop(ctx, stopId, op === "up" ? "up" : "down")),
    path(formId(f, "shipmentId")),
  );
}

export async function itemRowAction(_: ActionState, f: FormData) {
  return runAction((ctx) => svc.removeItem(ctx, formId(f)), path(formId(f, "shipmentId")));
}
