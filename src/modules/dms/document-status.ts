import type { DocumentStatus } from "@prisma/client";
import type { Permission } from "@/modules/iam/permissions";

export const DOCUMENT_TRANSITIONS = {
  submit: { from: ["DRAFT"], to: "PENDING_REVIEW", permission: "dms.documents.manage" },
  approve: { from: ["PENDING_REVIEW"], to: "APPROVED", permission: "dms.documents.approve" },
  reject: { from: ["PENDING_REVIEW"], to: "REJECTED", permission: "dms.documents.approve" },
  archive: { from: ["DRAFT", "APPROVED", "REJECTED"], to: "ARCHIVED", permission: "dms.documents.manage" },
} as const satisfies Record<string, { from: DocumentStatus[]; to: DocumentStatus; permission: Permission }>;

export type DocumentTransition = keyof typeof DOCUMENT_TRANSITIONS;

export function isDocumentTransition(t: string): t is DocumentTransition {
  return Object.hasOwn(DOCUMENT_TRANSITIONS, t);
}

export function nextDocumentStatus(from: DocumentStatus, t: DocumentTransition): DocumentStatus | null {
  const rule = DOCUMENT_TRANSITIONS[t];
  return (rule.from as readonly DocumentStatus[]).includes(from) ? rule.to : null;
}

export function documentTransitionPermission(t: DocumentTransition): Permission {
  return DOCUMENT_TRANSITIONS[t].permission;
}

export function availableDocumentTransitions(
  status: DocumentStatus,
  can: (p: Permission) => boolean,
): DocumentTransition[] {
  return (Object.keys(DOCUMENT_TRANSITIONS) as DocumentTransition[]).filter(
    (t) => nextDocumentStatus(status, t) !== null && can(documentTransitionPermission(t)),
  );
}

/** Em revisão o conteúdo fica congelado; arquivados são só de leitura. Nova versão volta sempre a DRAFT. */
export function canUploadVersion(status: DocumentStatus) {
  return status === "DRAFT" || status === "APPROVED" || status === "REJECTED";
}

export const EXPIRY_WARNING_DAYS = 30;

export function expiryWindowEnd(now = new Date()) {
  return new Date(now.getTime() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);
}

export function expiryState(expiresAt: Date | null, now = new Date()): "expired" | "expiring" | null {
  if (!expiresAt) return null;
  if (expiresAt <= now) return "expired";
  if (expiresAt <= expiryWindowEnd(now)) return "expiring";
  return null;
}
