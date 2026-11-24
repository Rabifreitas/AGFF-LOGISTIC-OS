import { NextResponse } from "next/server";
import { getActorContext } from "@/modules/iam/session-context";
import { geocode } from "@/modules/odf/routing";

export const dynamic = "force-dynamic";

/** Proxy autenticado para o Nominatim (OpenStreetMap). `results: null` = serviço não configurado. */
export async function GET(req: Request) {
  const ctx = await getActorContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const locale = searchParams.get("locale") === "en" ? "en" : "pt";
  return NextResponse.json({ results: await geocode(searchParams.get("q") ?? "", locale) });
}
