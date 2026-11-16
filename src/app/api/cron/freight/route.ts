import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sweepFreight } from "@/modules/odf/services/freight.service";

export const dynamic = "force-dynamic";

/** Avança o dispatch do frete imediato (ofertas expiradas, pedidos agendados). Protegido por CRON_SECRET. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sweepFreight());
}
