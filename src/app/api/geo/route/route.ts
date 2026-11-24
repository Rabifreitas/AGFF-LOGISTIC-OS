import { NextResponse } from "next/server";
import { isValidLatLng } from "@/modules/odf/geo";
import { getActorContext } from "@/modules/iam/session-context";
import { roadDistanceKm } from "@/modules/odf/routing";

export const dynamic = "force-dynamic";

/** Distância por estrada entre dois pontos (`from=lat,lng&to=lat,lng`), com a mesma regra usada no preço. */
export async function GET(req: Request) {
  const ctx = await getActorContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const parse = (v: string | null) => {
    const [lat, lng] = (v ?? "").split(",").map(Number);
    const p = { lat, lng };
    return Number.isFinite(lat) && Number.isFinite(lng) && isValidLatLng(p) ? p : null;
  };
  const a = parse(searchParams.get("from"));
  const b = parse(searchParams.get("to"));
  if (!a || !b) return NextResponse.json({ error: "invalid" }, { status: 400 });
  return NextResponse.json(await roadDistanceKm(a, b));
}
