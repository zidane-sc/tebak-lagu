import { NextResponse } from "next/server";
import { db, initDb, getRandomSong, getCatalogStats, rowToSong } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    const random = searchParams.get("random") === "true";
    const search = searchParams.get("search");

    // For autocomplete options: return title, artist, year, id
    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      const res = await db.execute({
        sql: "SELECT id, title, artist, year FROM songs WHERE title LIKE ? OR artist LIKE ? LIMIT 15;",
        args: [term, term],
      });

      const results = res.rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        artist: r.artist,
        year: r.year,
        display: `${r.title} - ${r.artist}`,
      }));

      return NextResponse.json({ results });
    }

    // Pick random song
    if (random) {
      const category = searchParams.get("category");
      const difficulty = searchParams.get("difficulty");
      const song = await getRandomSong(category, difficulty);
      return NextResponse.json({ song });
    }

    // Default: return stats and total
    const stats = await getCatalogStats();
    return NextResponse.json({
      total: stats.total,
      stats,
    });
  } catch (err: any) {
    console.error("API /api/songs error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
