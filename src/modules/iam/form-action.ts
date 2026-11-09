import { revalidatePath } from "next/cache";
import type { ZodType } from "zod";
import { UnauthenticatedError } from "@/lib/errors";
import { formToObject, fromZodError, toActionState, type ActionState } from "./action-result";
import type { ActorContext } from "./rbac";
import { getActorContext } from "./session-context";

export async function requireActionActor(): Promise<ActorContext> {
  const ctx = await getActorContext();
  if (!ctx) throw new UnauthenticatedError();
  return ctx;
}

/** Valida o FormData com Zod, executa o serviço (que verifica permissões) e revalida a rota. */
export async function runFormAction<T>(
  formData: FormData,
  schema: ZodType<T>,
  run: (ctx: ActorContext, data: T) => Promise<unknown>,
  path: string,
  message = "common.saved",
): Promise<ActionState> {
  const parsed = schema.safeParse(formToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await run(await requireActionActor(), parsed.data);
    revalidatePath(path);
    return { ok: true, message };
  } catch (e) {
    return toActionState(e);
  }
}

/** Para acções sem formulário validado (botões de transição/remoção). */
export async function runAction(run: (ctx: ActorContext) => Promise<unknown>, path: string): Promise<ActionState> {
  try {
    await run(await requireActionActor());
    revalidatePath(path);
    return { ok: true, message: "common.saved" };
  } catch (e) {
    return toActionState(e);
  }
}

export function formId(formData: FormData, key = "id") {
  return String(formData.get(key) ?? "");
}
