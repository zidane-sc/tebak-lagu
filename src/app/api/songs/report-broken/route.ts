import { NextResponse } from "next/server";
import { initDb, db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json().catch(() => ({}));
    const { songId, youtubeId, errorCode, reason } = body;

    if (!songId || typeof songId !== "string") {
      return NextResponse.json(
        { error: "songId is required and must be a string" },
        { status: 400 }
      );
    }

    const newStatus = errorCode === 100 ? "not_found" : "embed_disabled";

    let result;
    if (youtubeId && typeof youtubeId === "string") {
      result = await db.execute({
        sql: `UPDATE songs 
              SET youtube_status = ?,
                  youtube_checked_at = datetime('now')
              WHERE id = ? AND youtube_id = ?`,
        args: [newStatus, songId, youtubeId],
      });
    } else {
      result = await db.execute({
        sql: `UPDATE songs 
              SET youtube_status = ?,
                  youtube_checked_at = datetime('now')
              WHERE id = ?`,
        args: [newStatus, songId],
      });
    }

    console.warn(
      `[Report Broken Song] Song: ${songId} -> ${newStatus} (code: ${errorCode || "?"}, reason: ${reason || "?"}, rows: ${result.rowsAffected})`
    );

    return NextResponse.json({
      ok: true,
      songId,
      status: newStatus,
      rowsAffected: result.rowsAffected,
    });
  } catch (err: any) {
    console.error("[Report Broken Song Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
