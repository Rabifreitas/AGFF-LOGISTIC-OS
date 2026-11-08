import { headers } from "next/headers";

export type RequestMeta = { ip?: string; userAgent?: string };

export async function getRequestMeta(): Promise<RequestMeta> {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
    return { ip, userAgent: h.get("user-agent") ?? undefined };
  } catch {
    return {};
  }
}
