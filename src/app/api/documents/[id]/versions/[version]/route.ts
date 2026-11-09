import { isAppError } from "@/lib/errors";
import { openDocumentVersion } from "@/modules/dms/services/document.service";
import { getActorContext } from "@/modules/iam/session-context";

export const dynamic = "force-dynamic";

const STATUS = { UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404 } as Record<string, number>;

export async function GET(_: Request, { params }: { params: Promise<{ id: string; version: string }> }) {
  const ctx = await getActorContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  if (ctx.organizationStatus !== "ACTIVE") return new Response("Forbidden", { status: 403 });
  const { id, version } = await params;
  const n = Number(version);
  if (!Number.isInteger(n) || n < 1) return new Response("Not found", { status: 404 });
  try {
    const { version: v, stream } = await openDocumentVersion(ctx, id, n);
    return new Response(stream, {
      headers: {
        "Content-Type": v.mimeType,
        "Content-Length": String(v.sizeBytes),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(v.fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Checksum-SHA256": v.checksumSha256,
      },
    });
  } catch (e) {
    if (isAppError(e) && STATUS[e.code]) return new Response(e.code, { status: STATUS[e.code] });
    throw e;
  }
}
