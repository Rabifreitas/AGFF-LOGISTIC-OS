import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storageHealthy } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  let database = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch {}
  const storage = await storageHealthy();
  return NextResponse.json(
    { status: database ? "ok" : "degraded", database, storage },
    { status: database ? 200 : 503 },
  );
}
