import { NextResponse } from "next/server";
import { cronGuard } from "@/lib/cron-auth";
import { sweepDueAuctions } from "@/modules/mkt/services/auction.service";
import { sweepFreight } from "@/modules/odf/services/freight.service";

export const dynamic = "force-dynamic";

/** Vercel Cron (GET): fecha leilões vencidos e avança o dispatch do frete imediato. */
export async function GET(req: Request) {
  const denied = cronGuard(req);
  if (denied) return denied;
  const [auctions, freight] = await Promise.all([sweepDueAuctions(), sweepFreight()]);
  return NextResponse.json({ auctions, freight });
}

export const POST = GET;
