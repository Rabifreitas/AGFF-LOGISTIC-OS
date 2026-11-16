"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/modules/iam/action-result";
import { formId, runAction, runFormAction } from "@/modules/iam/form-action";
import { isTripStep } from "./rules";
import { freightRequestSchema, locationSchema, ratingSchema, tariffSchema, vehicleSchema } from "./schemas";
import * as svc from "./services/freight.service";

export async function createFreightRequestAction(_: ActionState, f: FormData): Promise<ActionState> {
  let id: string | null = null;
  const res = await runFormAction(
    f,
    freightRequestSchema,
    async (ctx, d) => {
      id = (await svc.createFreightRequest(ctx, d)).id;
    },
    "/app/freight",
  );
  if (res.ok && id) redirect(`/app/freight/${id}`);
  return res;
}

export async function cancelFreightAction(_: ActionState, f: FormData) {
  const id = formId(f);
  return runAction((ctx) => svc.cancelRequest(ctx, id), `/app/freight/${id}`);
}

export async function retryFreightAction(_: ActionState, f: FormData) {
  const id = formId(f);
  return runAction((ctx) => svc.retryRequest(ctx, id), `/app/freight/${id}`);
}

export async function confirmDeliveryAction(_: ActionState, f: FormData) {
  const id = formId(f);
  return runAction((ctx) => svc.confirmDelivery(ctx, id), `/app/freight/${id}`);
}

export async function rateFreightAction(_: ActionState, f: FormData) {
  const id = formId(f);
  return runFormAction(f, ratingSchema, (ctx, d) => svc.rateRequest(ctx, id, d), `/app/freight/${id}`);
}

export async function saveTariffAction(_: ActionState, f: FormData) {
  return runFormAction(f, tariffSchema, svc.saveTariff, "/admin/freight-tariffs");
}

export async function saveVehicleAction(_: ActionState, f: FormData) {
  const id = formId(f) || undefined;
  return runFormAction(f, vehicleSchema, (ctx, d) => svc.saveVehicle(ctx, d, id), "/app/fleet");
}

function optionalLocation(f: FormData) {
  const parsed = locationSchema.safeParse({ lat: f.get("lat") || undefined, lng: f.get("lng") || undefined });
  return parsed.success ? parsed.data : null;
}

export async function setOnlineAction(_: ActionState, f: FormData) {
  const online = f.get("online") === "1";
  return runAction((ctx) => svc.setDriverOnline(ctx, online, optionalLocation(f)), "/app/driver");
}

export async function respondOfferAction(_: ActionState, f: FormData) {
  const accept = f.get("decision") === "accept";
  return runAction((ctx) => svc.respondToOffer(ctx, formId(f), accept), "/app/driver");
}

export async function advanceTripAction(_: ActionState, f: FormData) {
  const step = String(f.get("step"));
  if (!isTripStep(step)) return { ok: false, error: "errors.invalidState" };
  const code = f.get("deliveryCode");
  return runAction(
    (ctx) =>
      svc.advanceTrip(ctx, formId(f), step, {
        deliveryCode: typeof code === "string" ? code : null,
        location: optionalLocation(f),
      }),
    "/app/driver",
  );
}

/** Chamado pelo telemóvel do motorista (watchPosition); sem revalidação de página. */
export async function reportLocationAction(lat: number, lng: number): Promise<ActionState> {
  const parsed = locationSchema.safeParse({ lat, lng });
  if (!parsed.success) return { ok: false, error: "odf.validation.point" };
  return runAction((ctx) => svc.reportLocation(ctx, parsed.data), "/app/driver");
}
