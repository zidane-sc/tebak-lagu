import { NextResponse } from "next/server";
import { initDb, getDeezerEnrichmentStats, enrichDeezerBatch } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await initDb();
    const stats = await getDeezerEnrichmentStats();
    return NextResponse.json(stats);
  } catch (err: any) {
    console.error("GET /api/admin/enrich error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json().catch(() => ({}));
    const batchSize = Math.min(100, Math.max(10, Number(body.batchSize || 30)));

    const result = await enrichDeezerBatch(batchSize);
    const stats = await getDeezerEnrichmentStats();

    return NextResponse.json({ success: true, ...result, stats });
  } catch (err: any) {
    console.error("POST /api/admin/enrich error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
