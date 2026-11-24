import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/** Exige `Authorization: Bearer $CRON_SECRET` (enviado pelo Vercel Cron). Sem segredo, o endpoint fica desactivado. */
export function cronGuard(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
