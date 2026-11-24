"use server";

import { z } from "zod";
import type { ActionState } from "@/modules/iam/action-result";
import { requireActionActor } from "@/modules/iam/form-action";
import { removeSubscription, saveSubscription } from "./push.service";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000).startsWith("https://"),
  p256dh: z.string().min(1).max(200),
  auth: z.string().min(1).max(100),
});

export async function savePushSubscriptionAction(input: unknown, userAgent?: string): Promise<ActionState> {
  const ctx = await requireActionActor();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "errors.invalidState" };
  await saveSubscription(ctx.userId, { ...parsed.data, userAgent });
  return { ok: true };
}

export async function removePushSubscriptionAction(endpoint: string): Promise<ActionState> {
  const ctx = await requireActionActor();
  await removeSubscription(ctx.userId, String(endpoint).slice(0, 1000));
  return { ok: true };
}
