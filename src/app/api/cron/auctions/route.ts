import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sweepDueAuctions } from "@/modules/mkt/services/auction.service";

export const dynamic = "force-dynamic";

/** Fecha/expira leilões vencidos. Protegido por CRON_SECRET (Authorization: Bearer ...). */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sweepDueAuctions());
}
