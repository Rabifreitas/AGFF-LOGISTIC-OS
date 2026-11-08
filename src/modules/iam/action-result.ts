import { ZodError } from "zod";
import { isAppError } from "@/lib/errors";

export type ActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  message?: string;
};

export function fromZodError(error: ZodError): ActionState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, error: "validation.invalid", fieldErrors };
}

/** Converte erros conhecidos em estado de formulário; relança os restantes (incl. redirects). */
export function toActionState(e: unknown): ActionState {
  if (e instanceof ZodError) return fromZodError(e);
  if (isAppError(e)) return { ok: false, error: e.message };
  throw e;
}

export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  formData.forEach((v, k) => {
    if (typeof v === "string" && !k.startsWith("$ACTION")) out[k] = v;
  });
  return out;
}
