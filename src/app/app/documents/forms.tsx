"use client";

import { useTranslations } from "next-intl";
import { ActionForm, Field, SelectField } from "@/components/form";
import { Input, Label } from "@/components/ui";
import { createDocumentAction, updateDocumentAction, uploadVersionAction } from "@/modules/dms/actions";
import { DOCUMENT_TYPES } from "@/modules/dms/schemas";
import type { ActionState } from "@/modules/iam/action-result";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx";

function FileField({ state, required }: { state: ActionState; required?: boolean }) {
  const t = useTranslations();
  const errors = state.fieldErrors?.file;
  return (
    <div>
      <Label htmlFor="file">{t("dms.file")}</Label>
      <Input id="file" name="file" type="file" accept={ACCEPT} required={required} aria-invalid={!!errors} />
      <p className="mt-1 text-xs text-gray-500">{t("dms.fileHint")}</p>
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

export function DocumentForm({ document, shipmentId, back }: { document?: Doc; shipmentId?: string; back?: string }) {
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
              <FileField state={s} />
            </div>
          )}
        </div>
      )}
    </ActionForm>
  );
}

export function VersionUploadForm({ documentId }: { documentId: string }) {
  const t = useTranslations();
  return (
    <ActionForm action={uploadVersionAction} submitLabel={t("dms.uploadVersion")} resetOnSuccess variant="gold">
      {(s) => (
        <>
          <input type="hidden" name="id" value={documentId} />
          <FileField state={s} required />
        </>
      )}
    </ActionForm>
  );
}
