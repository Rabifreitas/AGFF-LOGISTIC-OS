import { createHash } from "node:crypto";
import { InvalidStateError } from "@/lib/errors";

export const MAX_FILE_BYTES = 15 * 1024 * 1024;

type Kind = { mime: string; ext: string[]; magic: (b: Buffer) => boolean };

const startsWith = (b: Buffer, bytes: number[], offset = 0) => bytes.every((x, i) => b[offset + i] === x);
const isZip = (b: Buffer) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]);

const KINDS: Kind[] = [
  { mime: "application/pdf", ext: ["pdf"], magic: (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d]) },
  { mime: "image/png", ext: ["png"], magic: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { mime: "image/jpeg", ext: ["jpg", "jpeg"], magic: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  {
    mime: "image/webp",
    ext: ["webp"],
    magic: (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8),
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: ["docx"],
    magic: isZip,
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: ["xlsx"],
    magic: isZip,
  },
];

export const ACCEPTED_EXTENSIONS = KINDS.flatMap((k) => k.ext.map((e) => `.${e}`)).join(",");

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f"<>|*?:]/g, "_").trim();
  return (clean || "document").slice(-200);
}

/** O tipo é determinado pela extensão E pelos bytes iniciais; o Content-Type do cliente é ignorado. */
export function detectFileType(fileName: string, bytes: Buffer): string {
  if (bytes.length === 0) throw new InvalidStateError("dms.fileEmpty");
  if (bytes.length > MAX_FILE_BYTES) throw new InvalidStateError("dms.fileTooLarge");
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const kind = KINDS.find((k) => k.ext.includes(ext));
  if (!kind || !kind.magic(bytes)) throw new InvalidStateError("dms.fileType");
  return kind.mime;
}

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
