import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { ForbiddenError, InvalidStateError, NotFoundError } from "@/lib/errors";

const objects = vi.hoisted(() => new Map<string, Buffer>());
vi.mock("@/lib/storage", async (orig) => {
  const actual = await orig<typeof import("@/lib/storage")>();
  return {
    ...actual,
    putObject: vi.fn(async (key: string, body: Buffer) => void objects.set(key, Buffer.from(body))),
    deleteObject: vi.fn(async (key: string) => void objects.delete(key)),
    getObjectStream: vi.fn(async (key: string) => {
      const b = objects.get(key);
      if (!b) throw new Error("missing object");
      return new Blob([new Uint8Array(b)]).stream();
    }),
  };
});

import { sha256 } from "@/modules/dms/file-validation";
import { documentSchema } from "@/modules/dms/schemas";
import {
  countExpiringDocuments,
  createDocument,
  getDocument,
  listDocuments,
  openDocumentVersion,
  transitionDocument,
  updateDocument,
  uploadVersion,
} from "@/modules/dms/services/document.service";
import { loadActorContext } from "@/modules/iam/context-loader";
import type { RoleKey } from "@/modules/iam/permissions";
import type { ActorContext } from "@/modules/iam/rbac";
import { acceptInviteAsNewUser, createInvite } from "@/modules/iam/services/invite.service";
import { shipmentSchema } from "@/modules/shp/schemas";
import { createShipment } from "@/modules/shp/services/shipment.service";
import { createActiveCompany, PASSWORD, resetDatabase } from "./helpers";

type Company = Awaited<ReturnType<typeof createActiveCompany>>;
let A: Company;
let B: Company;

async function memberWithRole(company: Company, roleKey: RoleKey): Promise<ActorContext> {
  const email = `${roleKey.toLowerCase()}@${company.organization.id}.test`;
  const { token } = await createInvite(company.ctx, { email, roleKey });
  const { user } = await acceptInviteAsNewUser(token, { name: roleKey, password: PASSWORD });
  return (await loadActorContext(user.id, company.organization.id))!;
}

const pdf = (text = "factura") => ({ name: "factura.pdf", bytes: Buffer.from(`%PDF-1.7\n${text}\n`) });
const doc = (o: Record<string, unknown> = {}) =>
  documentSchema.parse({ type: "COMMERCIAL_INVOICE", title: "Factura FT 2026/1", ...o });

async function readAll(stream: ReadableStream) {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

beforeEach(async () => {
  objects.clear();
  await resetDatabase();
  A = await createActiveCompany();
  B = await createActiveCompany();
});

describe("DMS: versões, checksum e armazenamento", () => {
  it("cria um documento com a primeira versão, checksum e chave isolada por organização", async () => {
    const file = pdf();
    const d = await createDocument(A.ctx, doc(), file);
    const full = await getDocument(A.ctx, d.id);
    expect(full.currentVersion).toBe(1);
    expect(full.status).toBe("DRAFT");
    const [v] = full.versions;
    expect(v.checksumSha256).toBe(sha256(file.bytes));
    expect(v.mimeType).toBe("application/pdf");
    expect(v.sizeBytes).toBe(file.bytes.length);
    expect(v.storageKey.startsWith(`org/${A.organization.id}/documents/${d.id}/`)).toBe(true);
    expect(objects.get(v.storageKey)?.equals(file.bytes)).toBe(true);

    const audits = await prisma.auditLog.findMany({ where: { entityId: d.id }, orderBy: { createdAt: "asc" } });
    expect(audits.map((a) => a.action)).toEqual(["document.created", "document.version.uploaded"]);
  });

  it("nunca substitui versões e o download devolve o conteúdo exacto, com auditoria", async () => {
    const d = await createDocument(A.ctx, doc(), pdf("v1"));
    await uploadVersion(A.ctx, d.id, pdf("v2"));
    const full = await getDocument(A.ctx, d.id);
    expect(full.versions.map((v) => v.version)).toEqual([2, 1]);
    expect(new Set(full.versions.map((v) => v.storageKey)).size).toBe(2);

    const { stream, version } = await openDocumentVersion(A.ctx, d.id, 1);
    expect((await readAll(stream)).toString()).toContain("v1");
    expect(version.version).toBe(1);
    const audit = await prisma.auditLog.findFirst({ where: { entityId: d.id, action: "document.downloaded" } });
    expect(audit?.userId).toBe(A.ctx.userId);
  });

  it("rejeita ficheiros com conteúdo que não corresponde à extensão sem gravar nada", async () => {
    await expect(createDocument(A.ctx, doc(), { name: "factura.pdf", bytes: Buffer.from("<script>") })).rejects.toThrow(
      "dms.fileType",
    );
    expect(objects.size).toBe(0);
    expect(await prisma.document.count()).toBe(0);
  });

  it("não grava objectos novos enquanto o documento está em revisão", async () => {
    const d = await createDocument(A.ctx, doc(), pdf());
    await transitionDocument(A.ctx, d.id, "submit");
    await expect(uploadVersion(A.ctx, d.id, pdf("v2"))).rejects.toThrow("dms.locked");
    expect(objects.size).toBe(1);
  });
});

describe("DMS: aprovação", () => {
  it("submete, aprova e volta a rascunho com nova versão", async () => {
    const controller = await memberWithRole(A, "DOCUMENT_CONTROLLER");
    const d = await createDocument(A.ctx, doc(), pdf());
    await transitionDocument(A.ctx, d.id, "submit");
    const approved = await transitionDocument(controller, d.id, "approve");
    expect(approved.status).toBe("APPROVED");
    expect(approved.reviewedById).toBe(controller.userId);
    expect(approved.reviewedAt).not.toBeNull();

    await uploadVersion(A.ctx, d.id, pdf("v2"));
    const reset = await getDocument(A.ctx, d.id);
    expect(reset.status).toBe("DRAFT");
    expect(reset.reviewedById).toBeNull();
  });

  it("exige versão para submeter e motivo para rejeitar", async () => {
    const empty = await createDocument(A.ctx, doc());
    await expect(transitionDocument(A.ctx, empty.id, "submit")).rejects.toThrow("dms.needsVersion");

    const d = await createDocument(A.ctx, doc(), pdf());
    await transitionDocument(A.ctx, d.id, "submit");
    await expect(transitionDocument(A.ctx, d.id, "reject", "  ")).rejects.toThrow("dms.reasonRequired");
    const rejected = await transitionDocument(A.ctx, d.id, "reject", "NIF ilegível");
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.reviewNotes).toBe("NIF ilegível");
  });

  it("bloqueia alterações durante a revisão e depois de arquivado", async () => {
    const d = await createDocument(A.ctx, doc(), pdf());
    await transitionDocument(A.ctx, d.id, "submit");
    await expect(updateDocument(A.ctx, d.id, doc())).rejects.toThrow("dms.locked");
    await expect(transitionDocument(A.ctx, d.id, "submit")).rejects.toThrow(InvalidStateError);
    await transitionDocument(A.ctx, d.id, "approve");
    await transitionDocument(A.ctx, d.id, "archive");
    await expect(uploadVersion(A.ctx, d.id, pdf("v2"))).rejects.toThrow("dms.locked");
  });

  it("editar metadados de um documento aprovado exige nova revisão", async () => {
    const d = await createDocument(A.ctx, doc(), pdf());
    await transitionDocument(A.ctx, d.id, "submit");
    await transitionDocument(A.ctx, d.id, "approve");
    const after = await updateDocument(A.ctx, d.id, doc({ title: "Factura corrigida" }));
    expect(after.status).toBe("DRAFT");
  });
});

describe("DMS: RBAC", () => {
  it("só quem tem dms.documents.approve aprova; Auditor só lê; Motorista não acede", async () => {
    const manager = await memberWithRole(A, "LOGISTICS_MANAGER");
    const auditor = await memberWithRole(A, "AUDITOR");
    const driver = await memberWithRole(A, "DRIVER");
    const d = await createDocument(manager, doc(), pdf());
    await transitionDocument(manager, d.id, "submit");
    await expect(transitionDocument(manager, d.id, "approve")).rejects.toThrow(ForbiddenError);

    expect((await listDocuments(auditor)).map((x) => x.id)).toEqual([d.id]);
    await expect(createDocument(auditor, doc(), pdf())).rejects.toThrow(ForbiddenError);
    await expect(openDocumentVersion(driver, d.id, 1)).rejects.toThrow(ForbiddenError);
    await expect(listDocuments(driver)).rejects.toThrow(ForbiddenError);
  });
});

describe("DMS: isolamento multi-tenant", () => {
  it("a org B não lê, descarrega, altera nem liga documentos da org A", async () => {
    const d = await createDocument(A.ctx, doc(), pdf());
    expect(await listDocuments(B.ctx)).toEqual([]);
    await expect(getDocument(B.ctx, d.id)).rejects.toThrow(NotFoundError);
    await expect(openDocumentVersion(B.ctx, d.id, 1)).rejects.toThrow(NotFoundError);
    await expect(uploadVersion(B.ctx, d.id, pdf("intruso"))).rejects.toThrow(NotFoundError);
    await expect(transitionDocument(B.ctx, d.id, "submit")).rejects.toThrow(NotFoundError);
    await expect(updateDocument(B.ctx, d.id, doc())).rejects.toThrow(NotFoundError);
    expect(objects.size).toBe(1);

    const shipmentA = await createShipment(A.ctx, shipmentSchema.parse({ mode: "ROAD", currency: "AOA" }));
    await expect(createDocument(B.ctx, doc({ shipmentId: shipmentA.id }))).rejects.toThrow("dms.shipmentNotFound");
    const linked = await createDocument(A.ctx, doc({ shipmentId: shipmentA.id }));
    expect((await listDocuments(A.ctx, { shipmentId: shipmentA.id })).map((x) => x.id)).toEqual([linked.id]);
  });
});

describe("DMS: validade", () => {
  it("conta expirados e a expirar em 30 dias, excluindo arquivados", async () => {
    const day = 24 * 60 * 60 * 1000;
    const iso = (ms: number) => new Date(Date.now() + ms).toISOString().slice(0, 10);
    await createDocument(A.ctx, doc({ title: "Expirado", expiresAt: iso(-5 * day) }));
    await createDocument(A.ctx, doc({ title: "A expirar", expiresAt: iso(10 * day) }));
    await createDocument(A.ctx, doc({ title: "Longe", expiresAt: iso(200 * day) }));
    const archived = await createDocument(A.ctx, doc({ title: "Arquivado", expiresAt: iso(-1 * day) }));
    await transitionDocument(A.ctx, archived.id, "archive");
    await createDocument(B.ctx, doc({ title: "Outra org", expiresAt: iso(-1 * day) }));

    expect(await countExpiringDocuments(A.ctx)).toBe(2);
    const list = await listDocuments(A.ctx, { expiring: true });
    expect(list.map((x) => x.title)).toEqual(["Expirado", "A expirar"]);
  });
});
