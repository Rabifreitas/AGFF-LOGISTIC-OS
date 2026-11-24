"use client";

import { upload } from "@vercel/blob/client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ActionForm, Field, SelectField } from "@/components/form";
import { Input, Label } from "@/components/ui";
import { createDocumentAction, updateDocumentAction, uploadVersionAction } from "@/modules/dms/actions";
import { DOCUMENT_TYPES } from "@/modules/dms/schemas";
import type { ActionState } from "@/modules/iam/action-result";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx";

type UploadStatus = "idle" | "uploading" | "done" | "error";

/** Com `uploadPrefix`, o ficheiro vai directamente do browser para o armazenamento privado e o formulário só envia a chave. */
function FileField({
  state,
  required,
  uploadPrefix,
}: {
  state: ActionState;
  required?: boolean;
  uploadPrefix?: string | null;
}) {
  const t = useTranslations();
  const errors = state.fieldErrors?.file;
  const [staged, setStaged] = useState<{ key: string; name: string } | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const onFile = async (file: File | undefined) => {
    setStaged(null);
    if (!uploadPrefix || !file) return;
    setStatus("uploading");
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "document";
      const blob = await upload(`${uploadPrefix}/${safe}`, file, {
        access: "private",
        handleUploadUrl: "/api/documents/upload",
      });
      setStaged({ key: blob.pathname, name: file.name });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };
  return (
    <div>
      <Label htmlFor="file">{t("dms.file")}</Label>
      <Input
        id="file"
        name={uploadPrefix ? undefined : "file"}
        type="file"
        accept={ACCEPT}
        required={required}
        aria-invalid={!!errors}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {staged && (
        <>
          <input type="hidden" name="uploadKey" value={staged.key} />
          <input type="hidden" name="uploadName" value={staged.name} />
        </>
      )}
      <p className="mt-1 text-xs text-gray-500">{t("dms.fileHint")}</p>
      {status === "uploading" && <p className="mt-1 text-xs text-gray-600">{t("dms.uploading")}</p>}
      {status === "error" && <p className="mt-1 text-xs text-red-600">{t("dms.uploadFailed")}</p>}
      {errors?.map((e) => (
        <p key={e} className="mt-1 text-xs text-red-600">
          {t.has(e) ? t(e) : e}
        </p>
      ))}
    </div>
  );
}

type Doc = { id: string; type: string; title: string; expiresAt: Date | null };

const dateInput = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);

export function DocumentForm({
  document,
  shipmentId,
  back,
  uploadPrefix,
}: {
  document?: Doc;
  shipmentId?: string;
  back?: string;
  uploadPrefix?: string | null;
}) {
  const t = useTranslations();
  return (
    <ActionForm
      action={document ? updateDocumentAction : createDocumentAction}
      submitLabel={document ? t("common.save") : t("dms.new")}
      resetOnSuccess={!document}
    >
      {(s) => (
        <div className="grid gap-4 md:grid-cols-3">
          {document && <input type="hidden" name="id" value={document.id} />}
          {shipmentId && <input type="hidden" name="shipmentId" value={shipmentId} />}
          {back && <input type="hidden" name="back" value={back} />}
          <SelectField
            name="type"
            label={t("common.type")}
            state={s}
            defaultValue={document?.type ?? "COMMERCIAL_INVOICE"}
            options={DOCUMENT_TYPES.map((v) => ({ value: v, label: t(`dms.types.${v}`) }))}
          />
          <Field name="title" label={t("dms.titleField")} state={s} defaultValue={document?.title} required />
          <Field
            name="expiresAt"
            type="date"
            label={t("dms.expiresAt")}
            state={s}
            defaultValue={dateInput(document?.expiresAt)}
          />
          {!document && (
            <div className="md:col-span-3">
              <FileField state={s} uploadPrefix={uploadPrefix} />
            </div>
          )}
        </div>
      )}
    </ActionForm>
  );
}

export function VersionUploadForm({ documentId, uploadPrefix }: { documentId: string; uploadPrefix?: string | null }) {
  const t = useTranslations();
  return (
    <ActionForm action={uploadVersionAction} submitLabel={t("dms.uploadVersion")} resetOnSuccess variant="gold">
      {(s) => (
        <>
          <input type="hidden" name="id" value={documentId} />
          <FileField state={s} required uploadPrefix={uploadPrefix} />
        </>
      )}
    </ActionForm>
  );
}
