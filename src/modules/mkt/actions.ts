"use server";

import type { ActionState } from "@/modules/iam/action-result";
import { formId, runAction, runFormAction } from "@/modules/iam/form-action";
import { isPartnerTransition } from "./partner-status";
import { partnerSchema, verificationSchema } from "./schemas";
import * as svc from "./services/partner.service";

export async function createPartnerAction(_: ActionState, f: FormData) {
  return runFormAction(f, partnerSchema, svc.createPartner, "/app/partners");
}

export async function updatePartnerAction(_: ActionState, f: FormData) {
  const id = formId(f);
  return runFormAction(f, partnerSchema, (ctx, d) => svc.updatePartner(ctx, id, d), `/app/partners/${id}`);
}

export async function transitionPartnerAction(_: ActionState, f: FormData) {
  const id = formId(f);
  const t = String(f.get("transition"));
  if (!isPartnerTransition(t)) return { ok: false, error: "errors.invalidState" };
  return runAction((ctx) => svc.transitionPartner(ctx, id, t), `/app/partners/${id}`);
}

export async function addVerificationAction(_: ActionState, f: FormData) {
  const id = formId(f);
  return runFormAction(f, verificationSchema, (ctx, d) => svc.addVerification(ctx, id, d), `/app/partners/${id}`);
}

export async function reviewVerificationAction(_: ActionState, f: FormData) {
  const decision = f.get("transition") === "APPROVED" ? "APPROVED" : "REJECTED";
  return runAction(
    (ctx) => svc.reviewVerification(ctx, formId(f), decision),
    `/app/partners/${formId(f, "partnerId")}`,
  );
}
