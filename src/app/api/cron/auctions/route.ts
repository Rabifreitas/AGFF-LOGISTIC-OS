import { NextResponse } from "next/server";
import { cronGuard } from "@/lib/cron-auth";
import { sweepDueAuctions } from "@/modules/mkt/services/auction.service";

export const dynamic = "force-dynamic";

/** Fecha/expira leilões vencidos. Protegido por CRON_SECRET (Authorization: Bearer ...). */
export async function POST(req: Request) {
  const denied = cronGuard(req);
  if (denied) return denied;
  return NextResponse.json(await sweepDueAuctions());
}
