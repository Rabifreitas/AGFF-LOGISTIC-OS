"use server";

import { revalidatePath } from "next/cache";
import { getActorContext } from "@/modules/iam/session-context";
import { markNotificationsRead } from "./notification.service";

export async function markAllReadAction() {
  const ctx = await getActorContext();
  if (!ctx) return;
  await markNotificationsRead(ctx);
  revalidatePath("/app", "layout");
}
