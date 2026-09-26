import { NextResponse } from "next/server";
import { initDb, recordSongPlay, recordSongResult } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json();
    const { songId, action, isCorrect } = body;

    if (!songId) {
      return NextResponse.json({ error: "Missing songId" }, { status: 400 });
    }

    if (action === "play") {
      await recordSongPlay(songId);
    } else if (action === "result") {
      await recordSongResult(songId, Boolean(isCorrect));
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Track analytics API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
