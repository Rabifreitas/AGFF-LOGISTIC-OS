import { randomUUID } from "node:crypto";
import type { DocumentStatus, Prisma } from "@prisma/client";
import { InvalidStateError, NotFoundError } from "@/lib/errors";
import { deleteObject, getObjectStream, putObject, tenantObjectKey } from "@/lib/storage";
import { recordAudit } from "@/modules/audit/audit.service";
import { assertPermission, type ActorContext } from "@/modules/iam/rbac";
import { tenantDb } from "@/modules/tenancy/tenant-db";
import {
  canUploadVersion,
  documentTransitionPermission,
  expiryWindowEnd,
  nextDocumentStatus,
  type DocumentTransition,
} from "../document-status";
import { detectFileType, sanitizeFileName, sha256 } from "../file-validation";
import type { DocumentInput, UploadedFile } from "../schemas";

type Tx = Parameters<Parameters<ReturnType<typeof tenantDb>["$transaction"]>[0]>[0];

export type DocumentFilter = { status?: DocumentStatus; shipmentId?: string; expiring?: boolean };

export async function listDocuments(ctx: ActorContext, filter: DocumentFilter = {}, now = new Date()) {
  assertPermission(ctx, "dms.documents.read");
  const where: Prisma.DocumentWhereInput = {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.shipmentId ? { shipmentId: filter.shipmentId } : {}),
    ...(filter.expiring ? { expiresAt: { lte: expiryWindowEnd(now) }, status: { not: "ARCHIVED" } } : {}),
  };
  return tenantDb(ctx.organizationId).document.findMany({
    where,
    include: { shipment: { select: { id: true, reference: true } } },
    orderBy: filter.expiring ? { expiresAt: "asc" } : { updatedAt: "desc" },
    take: 500,
  });
}

/** Documentos não arquivados já expirados ou a expirar na janela de aviso. */
export async function countExpiringDocuments(ctx: ActorContext, now = new Date()) {
  assertPermission(ctx, "dms.documents.read");
  return tenantDb(ctx.organizationId).document.count({
    where: { expiresAt: { lte: expiryWindowEnd(now) }, status: { not: "ARCHIVED" } },
  });
}

export async function getDocument(ctx: ActorContext, id: string) {
  assertPermission(ctx, "dms.documents.read");
  const doc = await tenantDb(ctx.organizationId).document.findUnique({
    where: { id },
    include: {
      shipment: { select: { id: true, reference: true } },
      versions: { orderBy: { version: "desc" } },
    },
  });
  if (!doc) throw new NotFoundError();
  return doc;
}

async function assertShipmentInTenant(tx: Tx, shipmentId: string | null) {
  if (!shipmentId) return;
  const s = await tx.shipment.findUnique({ where: { id: shipmentId }, select: { id: true } });
  if (!s) throw new NotFoundError("dms.shipmentNotFound");
}

export async function createDocument(ctx: ActorContext, input: DocumentInput, file?: UploadedFile | null) {
  assertPermission(ctx, "dms.documents.manage");
  if (file) detectFileType(file.name, file.bytes);
  const doc = await tenantDb(ctx.organizationId).$transaction(async (tx) => {
    await assertShipmentInTenant(tx, input.shipmentId);
    const created = await tx.document.create({
      data: { ...input, organizationId: ctx.organizationId, createdById: ctx.userId },
    });
    await recordAudit(tx, ctx, {
      action: "document.created",
      entityType: "Document",
      entityId: created.id,
      after: created,
    });
    return created;
  });
  if (file) await uploadVersion(ctx, doc.id, file);
  return doc;
}

export async function updateDocument(ctx: ActorContext, id: string, input: Omit<DocumentInput, "shipmentId">) {
  assertPermission(ctx, "dms.documents.manage");
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    const before = await tx.document.findUnique({ where: { id } });
    if (!before) throw new NotFoundError();
    if (!canUploadVersion(before.status)) throw new InvalidStateError("dms.locked");
    const { type, title, expiresAt } = input;
    // Alterar metadados de um documento aprovado exige nova revisão.
    const after = await tx.document.update({
      where: { id },
      data: { type, title, expiresAt, ...(before.status === "DRAFT" ? {} : resetReview) },
    });
    await recordAudit(tx, ctx, { action: "document.updated", entityType: "Document", entityId: id, before, after });
    return after;
  });
}

const resetReview = { status: "DRAFT" as const, reviewedById: null, reviewedAt: null, reviewNotes: null };

/**
 * Cada upload cria uma versão nova (nunca substitui) com SHA-256. O objecto é gravado sob o prefixo
 * da organização com chave única antes da transacção; se a transacção falhar, é removido.
 */
export async function uploadVersion(ctx: ActorContext, documentId: string, file: UploadedFile) {
  assertPermission(ctx, "dms.documents.manage");
  const db = tenantDb(ctx.organizationId);
  const existing = await db.document.findUnique({ where: { id: documentId }, select: { status: true } });
  if (!existing) throw new NotFoundError();
  if (!canUploadVersion(existing.status)) throw new InvalidStateError("dms.locked");

  const fileName = sanitizeFileName(file.name);
  const mimeType = detectFileType(fileName, file.bytes);
  const checksumSha256 = sha256(file.bytes);
  const storageKey = tenantObjectKey(ctx.organizationId, "documents", documentId, randomUUID());
  await putObject(storageKey, file.bytes, mimeType);

  try {
    return await db.$transaction(async (tx) => {
      const before = await tx.document.findUnique({ where: { id: documentId } });
      if (!before) throw new NotFoundError();
      if (!canUploadVersion(before.status)) throw new InvalidStateError("dms.locked");
      const version = before.currentVersion + 1;
      const { count } = await tx.document.updateMany({
        where: { id: documentId, currentVersion: before.currentVersion, status: before.status },
        data: { currentVersion: version, ...resetReview },
      });
      if (count !== 1) throw new InvalidStateError("dms.concurrentChange");
      const created = await tx.documentVersion.create({
        data: {
          organizationId: ctx.organizationId,
          documentId,
          version,
          storageKey,
          fileName,
          mimeType,
          sizeBytes: file.bytes.length,
          checksumSha256,
          uploadedById: ctx.userId,
        },
      });
      await recordAudit(tx, ctx, {
        action: "document.version.uploaded",
        entityType: "Document",
        entityId: documentId,
        before: { status: before.status, currentVersion: before.currentVersion },
        after: { status: "DRAFT", currentVersion: version, fileName, sizeBytes: created.sizeBytes, checksumSha256 },
      });
      return created;
    });
  } catch (e) {
    await deleteObject(storageKey).catch(() => undefined);
    throw e;
  }
}

export async function transitionDocument(
  ctx: ActorContext,
  id: string,
  transition: DocumentTransition,
  reason?: string | null,
) {
  assertPermission(ctx, documentTransitionPermission(transition));
  const notes = reason?.trim() || null;
  if (transition === "reject" && !notes) throw new InvalidStateError("dms.reasonRequired");
  return tenantDb(ctx.organizationId).$transaction(async (tx) => {
    const before = await tx.document.findUnique({ where: { id } });
    if (!before) throw new NotFoundError();
    const to = nextDocumentStatus(before.status, transition);
    if (!to) throw new InvalidStateError("dms.invalidTransition");
    if (transition === "submit" && before.currentVersion === 0) throw new InvalidStateError("dms.needsVersion");
    const review =
      transition === "approve" || transition === "reject"
        ? { reviewedById: ctx.userId, reviewedAt: new Date(), reviewNotes: notes }
        : {};
    const { count } = await tx.document.updateMany({
      where: { id, status: before.status, currentVersion: before.currentVersion },
      data: { status: to, ...review },
    });
    if (count !== 1) throw new InvalidStateError("dms.concurrentChange");
    const after = await tx.document.findUniqueOrThrow({ where: { id } });
    await recordAudit(tx, ctx, {
      action: `document.${transition}`,
      entityType: "Document",
      entityId: id,
      before: { status: before.status },
      after: { status: to, version: before.currentVersion, ...(notes ? { notes } : {}) },
    });
    return after;
  });
}

/** Lê uma versão para download (via app, nunca URL público) e regista o acesso na auditoria. */
export async function openDocumentVersion(ctx: ActorContext, documentId: string, version: number) {
  assertPermission(ctx, "dms.documents.read");
  const db = tenantDb(ctx.organizationId);
  const v = await db.documentVersion.findFirst({ where: { documentId, version } });
  if (!v) throw new NotFoundError();
  const stream = await getObjectStream(v.storageKey);
  await recordAudit(db, ctx, {
    action: "document.downloaded",
    entityType: "Document",
    entityId: documentId,
    after: { version, fileName: v.fileName },
  });
  return { version: v, stream };
}
