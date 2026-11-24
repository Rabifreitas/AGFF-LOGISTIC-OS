import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { directUploadPrefix } from "@/lib/storage";
import { MAX_FILE_BYTES } from "@/modules/dms/file-validation";
import { hasPermission } from "@/modules/iam/rbac";
import { getActorContext } from "@/modules/iam/session-context";

export const dynamic = "force-dynamic";

/** Emite tokens de upload directo para o Blob privado, só para o prefixo da organização activa. */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const ctx = await getActorContext();
        if (!ctx || ctx.organizationStatus !== "ACTIVE" || !hasPermission(ctx, "dms.documents.manage")) {
          throw new Error("forbidden");
        }
        const prefix = directUploadPrefix(ctx.organizationId);
        if (!prefix || !pathname.startsWith(`${prefix}/`) || pathname.includes("..")) throw new Error("forbidden");
        return {
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60_000,
        };
      },
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
}
