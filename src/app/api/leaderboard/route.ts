import { NextResponse } from "next/server";
import { initDb, getLeaderboard, submitLeaderboardScore } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    const tab = (searchParams.get("tab") as "all_time" | "weekly") || "all_time";
    const mode = searchParams.get("mode") || "all";
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const leaderboard = await getLeaderboard({
      tab,
      mode,
      limit,
    });

    return NextResponse.json({
      tab,
      mode,
      leaderboard,
    });
  } catch (err: any) {
    console.error("Leaderboard GET API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json();
    const { user_id, player_name, player_avatar, mode, category, difficulty, score } = body;

    if (!player_name || score === undefined) {
      return NextResponse.json(
        { error: "Nama pemain dan skor wajib diisi!" },
        { status: 400 }
      );
    }

    const res = await submitLeaderboardScore({
      user_id,
      player_name,
      player_avatar,
      mode: mode || "heardle",
      category: category || "Semua Genre",
      difficulty: difficulty || "easy",
      score: parseInt(score, 10) || 0,
    });

    return NextResponse.json({
      success: true,
      id: res.id,
      message: "Skor berhasil dicatat ke Papan Peringkat!",
    });
  } catch (err: any) {
    console.error("Leaderboard POST API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
