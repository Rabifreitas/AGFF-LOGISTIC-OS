"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import type { ActionState } from "@/modules/iam/action-result";
import { requireActionActor } from "@/modules/iam/form-action";
import { isAllowedPushEndpoint, PUSH_DEVICE_COOKIE, removeSubscription, saveSubscription } from "./push.service";

const subscriptionSchema = z.object({
  endpoint: z.string().max(1000).refine(isAllowedPushEndpoint),
  p256dh: z.string().min(1).max(200),
  auth: z.string().min(1).max(100),
});

export async function savePushSubscriptionAction(input: unknown, userAgent?: string): Promise<ActionState> {
  const ctx = await requireActionActor();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "errors.invalidState" };
  const sub = await saveSubscription(ctx.userId, { ...parsed.data, userAgent });
  (await cookies()).set(PUSH_DEVICE_COOKIE, sub.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true };
}

export async function removePushSubscriptionAction(endpoint: string): Promise<ActionState> {
  const ctx = await requireActionActor();
  await removeSubscription(ctx.userId, String(endpoint).slice(0, 1000));
  (await cookies()).delete(PUSH_DEVICE_COOKIE);
  return { ok: true };
}
