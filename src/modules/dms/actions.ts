"use server";

import { InvalidStateError } from "@/lib/errors";
import { deleteObject, directUploadPrefix, getObjectBytes } from "@/lib/storage";
import type { ActionState } from "@/modules/iam/action-result";
import type { ActorContext } from "@/modules/iam/rbac";
import { formId, runAction, runFormAction } from "@/modules/iam/form-action";
import { isDocumentTransition } from "./document-status";
import { MAX_FILE_BYTES } from "./file-validation";
import { documentSchema, type UploadedFile } from "./schemas";
import * as svc from "./services/document.service";

type FileSource = { name: string; file?: File; stagedKey?: string } | null;

function fileFrom(f: FormData): FileSource {
  const staged = formId(f, "uploadKey");
  if (staged) return { name: formId(f, "uploadName") || "document", stagedKey: staged };
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  return { name: file.name, file };
}

async function withFile<T>(ctx: ActorContext, src: FileSource, run: (file: UploadedFile | null) => Promise<T>) {
  if (!src) return run(null);
  if (src.file) return run({ name: src.name, bytes: Buffer.from(await src.file.arrayBuffer()) });
  if (!src.stagedKey) return run(null);
  const prefix = directUploadPrefix(ctx.organizationId);
  if (!prefix || !src.stagedKey.startsWith(`${prefix}/`) || src.stagedKey.includes("..")) {
    throw new InvalidStateError("dms.fileType");
  }
  try {
    const bytes = await getObjectBytes(src.stagedKey, MAX_FILE_BYTES).catch(() => {
      throw new InvalidStateError("dms.fileTooLarge");
    });
    return await run({ name: src.name, bytes });
  } finally {
    await deleteObject(src.stagedKey).catch(() => undefined);
  }
}

function backPath(f: FormData, fallback: string) {
  const back = formId(f, "back");
  return back.startsWith("/app/") ? back : fallback;
}

export async function createDocumentAction(_: ActionState, f: FormData) {
  const src = fileFrom(f);
  return runFormAction(
    f,
    documentSchema,
    (ctx, d) => withFile(ctx, src, (file) => svc.createDocument(ctx, d, file)),
    backPath(f, "/app/documents"),
  );
}

export async function updateDocumentAction(_: ActionState, f: FormData) {
  const id = formId(f);
  return runFormAction(f, documentSchema, (ctx, d) => svc.updateDocument(ctx, id, d), `/app/documents/${id}`);
}

export async function uploadVersionAction(_: ActionState, f: FormData) {
  const id = formId(f);
  const src = fileFrom(f);
  if (!src) return { ok: false, fieldErrors: { file: ["validation.required"] } };
  return runAction(
    (ctx) => withFile(ctx, src, (file) => (file ? svc.uploadVersion(ctx, id, file) : Promise.resolve(null))),
    `/app/documents/${id}`,
  );
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
