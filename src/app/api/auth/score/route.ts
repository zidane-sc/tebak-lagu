import { NextResponse } from "next/server";
import { initDb, updateUserStats } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json();
    const { userId, pointsGained, isWin } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const updatedUser = await updateUserStats(
      userId,
      parseInt(pointsGained || "0", 10),
      Boolean(isWin)
    );

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (err: any) {
    console.error("Auth Score API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
