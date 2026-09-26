import { NextResponse } from "next/server";
import { initDb, getAnalyticsData } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await initDb();
    const data = await getAnalyticsData();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Analytics GET API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
