import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";

    const conditions: string[] = ["a.is_active = 1", "a.song_count >= 2"];
    const args: any[] = [];

    if (search) {
      conditions.push("a.name LIKE ?");
      args.push(`%${search}%`);
    }

    if (category && category !== "all" && category !== "Semua Playlist") {
      conditions.push("a.category = ?");
      args.push(category);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const res = await db.execute({
      sql: `
        SELECT 
          a.id, 
          a.name, 
          a.image, 
          a.category, 
          a.song_count
        FROM artists a
        ${whereClause}
        ORDER BY a.song_count DESC
        LIMIT 60;
      `,
      args,
    });

    const artists = res.rows.map((r: any) => ({
      id: String(r.id),
      name: String(r.name),
      image: r.image || "",
      category: r.category || "Pop",
      songCount: Number(r.song_count || 0),
    }));

    return NextResponse.json({ artists });
  } catch (err: any) {
    console.error("GET /api/artists error:", err);
    return NextResponse.json({ artists: [] });
  }
}
