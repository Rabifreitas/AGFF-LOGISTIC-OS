"use server";

import { revalidatePath } from "next/cache";
import { UnauthenticatedError } from "@/lib/errors";
import { formToObject, fromZodError, toActionState, type ActionState } from "@/modules/iam/action-result";
import { getActorContext } from "@/modules/iam/session-context";
import {
  addressSchema,
  contactSchema,
  costCenterSchema,
  departmentSchema,
  orgProfileSchema,
  orgSettingsSchema,
  representativeSchema,
} from "./schemas";
import * as org from "./services/org.service";

async function actor() {
  const ctx = await getActorContext();
  if (!ctx) throw new UnauthenticatedError();
  return ctx;
}

type Schema = {
  safeParse: (v: unknown) => { success: true; data: unknown } | { success: false; error: import("zod").ZodError };
};

function formAction<S extends Schema>(
  schema: S,
  run: (ctx: Awaited<ReturnType<typeof actor>>, data: never) => Promise<unknown>,
  path: string,
  message = "common.saved",
) {
  return async (_: ActionState, formData: FormData): Promise<ActionState> => {
    const raw: Record<string, unknown> = formToObject(formData);
    if (formData.has("isPrimary")) raw.isPrimary = formData.get("isPrimary") === "on";
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return fromZodError(parsed.error);
    try {
      await run(await actor(), parsed.data as never);
      revalidatePath(path);
      return { ok: true, message };
    } catch (e) {
      return toActionState(e);
    }
  };
}

export async function updateProfileAction(s: ActionState, f: FormData) {
  return formAction(orgProfileSchema, org.updateOrganizationProfile, "/app/organization")(s, f);
}
export async function addAddressAction(s: ActionState, f: FormData) {
  return formAction(addressSchema, org.addAddress, "/app/organization")(s, f);
}
export async function addContactAction(s: ActionState, f: FormData) {
  return formAction(contactSchema, org.addContact, "/app/organization")(s, f);
}
export async function addRepresentativeAction(s: ActionState, f: FormData) {
  return formAction(representativeSchema, org.addRepresentative, "/app/organization")(s, f);
}
export async function createDepartmentAction(s: ActionState, f: FormData) {
  return formAction(departmentSchema, org.createDepartment, "/app/organization/departments")(s, f);
}
export async function createCostCenterAction(s: ActionState, f: FormData) {
  return formAction(costCenterSchema, org.createCostCenter, "/app/organization/cost-centers")(s, f);
}
export async function updateSettingsAction(s: ActionState, f: FormData) {
  return formAction(orgSettingsSchema, org.updateOrganizationSettings, "/app/organization/settings")(s, f);
}

export async function removeOrgChildAction(formData: FormData) {
  const ctx = await actor();
  const id = String(formData.get("id"));
  const kind = String(formData.get("kind"));
  const handlers: Record<string, (c: typeof ctx, id: string) => Promise<unknown>> = {
    address: org.removeAddress,
    contact: org.removeContact,
    representative: org.removeRepresentative,
    department: org.deleteDepartment,
    costCenter: org.deleteCostCenter,
  };
  await handlers[kind]?.(ctx, id);
  revalidatePath("/app/organization", "layout");
}

export async function toggleCostCenterAction(formData: FormData) {
  await org.setCostCenterActive(await actor(), String(formData.get("id")), formData.get("active") === "true");
  revalidatePath("/app/organization/cost-centers");
}
