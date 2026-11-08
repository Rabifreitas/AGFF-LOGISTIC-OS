"use server";

import { revalidatePath } from "next/cache";
import { UnauthenticatedError } from "@/lib/errors";
import { sendMail } from "@/lib/mail";
import { organizationStatusEmail } from "@/lib/mail-templates";
import { fromZodError, formToObject, toActionState, type ActionState } from "@/modules/iam/action-result";
import { getActorContext } from "@/modules/iam/session-context";
import {
  exchangeRateSchema,
  setOrganizationExchangeRate,
  setPlatformExchangeRate,
} from "@/modules/fin/services/exchange-rate.service";
import type { OrganizationTransition } from "@/modules/org/status";
import { setUserLock, transitionOrganization } from "./services/platform.service";

async function actor() {
  const ctx = await getActorContext();
  if (!ctx) throw new UnauthenticatedError();
  return ctx;
}

const TRANSITIONS: OrganizationTransition[] = ["approve", "reject", "suspend", "reactivate"];

export async function transitionOrganizationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const transition = String(formData.get("transition")) as OrganizationTransition;
  if (!TRANSITIONS.includes(transition)) return { ok: false, error: "admin.invalidTransition" };
  const id = String(formData.get("organizationId"));
  try {
    const reason = String(formData.get("reason") ?? "") || undefined;
    const { organization, notifiedAdmins } = await transitionOrganization(await actor(), id, transition, reason);
    for (const admin of notifiedAdmins) {
      await sendMail(
        organizationStatusEmail({
          to: admin.email,
          name: admin.name,
          organization: organization.name,
          status: organization.status,
          reason,
          locale: admin.locale,
        }),
      );
    }
    revalidatePath("/admin", "layout");
    return { ok: true, message: "common.saved" };
  } catch (e) {
    return toActionState(e);
  }
}

export async function setUserLockAction(formData: FormData) {
  await setUserLock(
    await actor(),
    String(formData.get("userId")),
    formData.get("locked") === "true",
    String(formData.get("reason") ?? ""),
  );
  revalidatePath("/admin/users");
}

export async function setExchangeRateAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = exchangeRateSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const ctx = await actor();
    if (formData.get("scope") === "organization") await setOrganizationExchangeRate(ctx, parsed.data);
    else await setPlatformExchangeRate(ctx, parsed.data);
    revalidatePath("/admin/exchange-rates");
    revalidatePath("/app/exchange-rates");
    return { ok: true, message: "common.saved" };
  } catch (e) {
    return toActionState(e);
  }
}
