"use server";

import type { ActionState } from "@/modules/iam/action-result";
import { formId, runAction, runFormAction } from "@/modules/iam/form-action";
import { isDocumentTransition } from "./document-status";
import { documentSchema, type UploadedFile } from "./schemas";
import * as svc from "./services/document.service";

async function fileFrom(f: FormData): Promise<UploadedFile | null> {
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  return { name: file.name, bytes: Buffer.from(await file.arrayBuffer()) };
}

function backPath(f: FormData, fallback: string) {
  const back = formId(f, "back");
  return back.startsWith("/app/") ? back : fallback;
}

export async function createDocumentAction(_: ActionState, f: FormData) {
  const file = await fileFrom(f);
  return runFormAction(f, documentSchema, (ctx, d) => svc.createDocument(ctx, d, file), backPath(f, "/app/documents"));
}

export async function updateDocumentAction(_: ActionState, f: FormData) {
  const id = formId(f);
  return runFormAction(f, documentSchema, (ctx, d) => svc.updateDocument(ctx, id, d), `/app/documents/${id}`);
}

export async function uploadVersionAction(_: ActionState, f: FormData) {
  const id = formId(f);
  const file = await fileFrom(f);
  if (!file) return { ok: false, fieldErrors: { file: ["validation.required"] } };
  return runAction((ctx) => svc.uploadVersion(ctx, id, file), `/app/documents/${id}`);
}

export async function transitionDocumentAction(_: ActionState, f: FormData) {
  const id = formId(f);
  const t = String(f.get("transition"));
  if (!isDocumentTransition(t)) return { ok: false, error: "errors.invalidState" };
  const reason = f.get("reason");
  return runAction(
    (ctx) => svc.transitionDocument(ctx, id, t, typeof reason === "string" ? reason : null),
    `/app/documents/${id}`,
  );
}
