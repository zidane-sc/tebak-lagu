import { NextResponse } from "next/server";
import { initDb, getAnalyticsData } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    await initDb();
    const data = await getAnalyticsData();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Analytics GET API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
