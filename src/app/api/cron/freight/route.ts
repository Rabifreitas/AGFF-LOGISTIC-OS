import { NextResponse } from "next/server";
import { cronGuard } from "@/lib/cron-auth";
import { sweepFreight } from "@/modules/odf/services/freight.service";

export const dynamic = "force-dynamic";

/** Avança o dispatch do frete imediato (ofertas expiradas, pedidos agendados). Protegido por CRON_SECRET. */
export async function POST(req: Request) {
  const denied = cronGuard(req);
  if (denied) return denied;
  return NextResponse.json(await sweepFreight());
}
