import { NextResponse } from "next/server";
import { db, initDb, rowToSong } from "@/lib/db";

// In-memory cache for ultra-fast repeated queries (0ms)
const searchCache = new Map<string, any[]>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const queryLower = q.toLowerCase();

  // Check in-memory cache
  if (searchCache.has(queryLower)) {
    return NextResponse.json({ results: searchCache.get(queryLower) });
  }

  try {
    await initDb();
    // 1. Instant local DB matches ranked by relevance and popularity
    const tokens = queryLower.split(/\s+/).filter((t) => t.length > 0);
    const starts = `${queryLower}%`;
    const word = `% ${queryLower}%`;
    const contains = `%${queryLower}%`;

    // Multi-token AND conditions across title, artist, and search_query
    const whereConditions = tokens
      .map(() => "(LOWER(title || ' ' || artist || ' ' || COALESCE(search_query, '')) LIKE ?)")
      .join(" AND ");
    const tokenArgs = tokens.map((t) => `%${t}%`);

    let relevanceSql = "";
    let relevanceArgs: any[] = [];

    if (tokens.length > 1) {
      // Cross-match bonus: words match across title & artist (e.g. "bernadya satu bulan")
      const titleMatches = tokens.map(() => "LOWER(title) LIKE ?").join(" OR ");
      const artistMatches = tokens.map(() => "LOWER(artist || ' ' || COALESCE(search_query, '')) LIKE ?").join(" OR ");
      const titleArgs = tokens.map((t) => `%${t}%`);
      const artistArgs = tokens.map((t) => `%${t}%`);

      relevanceSql = `
        CASE 
          WHEN LOWER(title) = ? THEN 1000
          WHEN LOWER(artist) = ? THEN 800
          WHEN LOWER(title) LIKE ? THEN 700
          WHEN LOWER(artist) LIKE ? THEN 600
          WHEN (${titleMatches}) AND (${artistMatches}) THEN 950
          WHEN LOWER(search_query) LIKE ? THEN 850
          ELSE 300
        END as relevance
      `;
      relevanceArgs = [queryLower, queryLower, starts, starts, ...titleArgs, ...artistArgs, contains];
    } else {
      relevanceSql = `
        CASE 
          WHEN LOWER(title) = ? THEN 1000
          WHEN LOWER(title) LIKE ? THEN 500
          WHEN LOWER(title) LIKE ? THEN 300
          WHEN LOWER(artist) = ? THEN 200
          WHEN LOWER(artist) LIKE ? THEN 100
          WHEN LOWER(search_query) LIKE ? THEN 80
          ELSE 10
        END as relevance
      `;
      relevanceArgs = [queryLower, starts, word, queryLower, starts, contains];
    }

    const sql = `
      SELECT id, title, artist, album_cover,
        ${relevanceSql}
      FROM songs
      WHERE (is_active = 1 OR is_active IS NULL)
        AND (${whereConditions})
      ORDER BY relevance DESC, deezer_rank DESC, times_played DESC
      LIMIT 10;
    `;

    const localRes = await db.execute({
      sql,
      args: [...relevanceArgs, ...tokenArgs],
    });

    const results = localRes.rows.map((r: any) => ({
      id: String(r.id),
      title: String(r.title),
      artist: String(r.artist),
      albumCover: r.album_cover || "",
    }));

    if (searchCache.size > 300) {
      const firstKey = searchCache.keys().next().value;
      if (firstKey) searchCache.delete(firstKey);
    }
    searchCache.set(queryLower, results);

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error("Search error:", err);
    return NextResponse.json({ results: [] });
  }
}
