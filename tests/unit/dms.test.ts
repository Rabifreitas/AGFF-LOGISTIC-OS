import { describe, expect, it } from "vitest";
import {
  availableDocumentTransitions,
  canUploadVersion,
  expiryState,
  isDocumentTransition,
  nextDocumentStatus,
} from "@/modules/dms/document-status";
import { MAX_FILE_BYTES, detectFileType, sanitizeFileName, sha256 } from "@/modules/dms/file-validation";
import { documentSchema } from "@/modules/dms/schemas";
import { roleHasPermission } from "@/modules/iam/rbac";

const pdf = Buffer.from("%PDF-1.7\n%âãÏÓ\n1 0 obj\n");
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

describe("document status machine", () => {
  it("allows only the approval flow", () => {
    expect(nextDocumentStatus("DRAFT", "submit")).toBe("PENDING_REVIEW");
    expect(nextDocumentStatus("PENDING_REVIEW", "approve")).toBe("APPROVED");
    expect(nextDocumentStatus("PENDING_REVIEW", "reject")).toBe("REJECTED");
    expect(nextDocumentStatus("APPROVED", "archive")).toBe("ARCHIVED");
    expect(nextDocumentStatus("DRAFT", "approve")).toBeNull();
    expect(nextDocumentStatus("APPROVED", "submit")).toBeNull();
    expect(nextDocumentStatus("PENDING_REVIEW", "archive")).toBeNull();
    expect(nextDocumentStatus("ARCHIVED", "submit")).toBeNull();
  });

  it("rejects unknown transitions", () => {
    expect(isDocumentTransition("approve")).toBe(true);
    expect(isDocumentTransition("toString")).toBe(false);
    expect(isDocumentTransition("")).toBe(false);
  });

  it("filters transitions by permission", () => {
    const manageOnly = (p: string) => p === "dms.documents.manage";
    const approver = (p: string) => p === "dms.documents.approve";
    expect(availableDocumentTransitions("PENDING_REVIEW", manageOnly)).toEqual([]);
    expect(availableDocumentTransitions("PENDING_REVIEW", approver)).toEqual(["approve", "reject"]);
    expect(availableDocumentTransitions("DRAFT", manageOnly)).toEqual(["submit", "archive"]);
  });

  it("freezes content while in review or archived", () => {
    expect(canUploadVersion("DRAFT")).toBe(true);
    expect(canUploadVersion("APPROVED")).toBe(true);
    expect(canUploadVersion("REJECTED")).toBe(true);
    expect(canUploadVersion("PENDING_REVIEW")).toBe(false);
    expect(canUploadVersion("ARCHIVED")).toBe(false);
  });

  it("classifies expiry with a 30-day window", () => {
    const now = new Date("2026-11-09T12:00:00Z");
    expect(expiryState(null, now)).toBeNull();
    expect(expiryState(new Date("2026-11-01"), now)).toBe("expired");
    expect(expiryState(new Date("2026-12-01"), now)).toBe("expiring");
    expect(expiryState(new Date("2027-03-01"), now)).toBeNull();
  });
});

describe("file validation", () => {
  it("accepts files whose content matches the extension", () => {
    expect(detectFileType("fatura.pdf", pdf)).toBe("application/pdf");
    expect(detectFileType("FOTO.PNG", png)).toBe("image/png");
  });

  it("rejects spoofed, empty, oversized or unsupported files", () => {
    expect(() => detectFileType("fatura.pdf", png)).toThrow("dms.fileType");
    expect(() => detectFileType("script.html", Buffer.from("<html>"))).toThrow("dms.fileType");
    expect(() => detectFileType("vazio.pdf", Buffer.alloc(0))).toThrow("dms.fileEmpty");
    const big = Buffer.concat([pdf, Buffer.alloc(MAX_FILE_BYTES)]);
    expect(() => detectFileType("grande.pdf", big)).toThrow("dms.fileTooLarge");
  });

  it("sanitizes file names", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName('C:\\tmp\\a"b<c>.pdf')).toBe("a_b_c_.pdf");
    expect(sanitizeFileName("")).toBe("document");
  });

  it("computes SHA-256", () => {
    expect(sha256(Buffer.from("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("document schema & permissions", () => {
  it("validates input", () => {
    expect(documentSchema.safeParse({ type: "COMMERCIAL_INVOICE", title: "Factura 1" }).success).toBe(true);
    expect(documentSchema.safeParse({ type: "NOPE", title: "Factura 1" }).success).toBe(false);
    expect(documentSchema.safeParse({ type: "OTHER", title: "x" }).success).toBe(false);
    expect(documentSchema.safeParse({ type: "OTHER", title: "Doc", expiresAt: "não-data" }).success).toBe(false);
  });

  it("gives approval to the Document Controller, not to the Auditor or Driver", () => {
    expect(roleHasPermission("DOCUMENT_CONTROLLER", "dms.documents.approve")).toBe(true);
    expect(roleHasPermission("AUDITOR", "dms.documents.manage")).toBe(false);
    expect(roleHasPermission("DRIVER", "dms.documents.read")).toBe(false);
  });
});
