import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";

// In-memory LRU cache for ultra-fast repeated queries (0ms)
const searchCache = new Map<string, any[]>();

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const queryLower = q.toLowerCase();

  // Check in-memory cache
  if (searchCache.has(queryLower)) {
    return NextResponse.json({ results: searchCache.get(queryLower), cached: true });
  }

  try {
    await initDb();

    // 1. FAST-PATH: SQLite FTS5 Virtual Table (Sub-Millisecond with BM25 Ranking)
    const cleanTokens = queryLower.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);

    if (cleanTokens.length > 0) {
      try {
        const ftsQuery = cleanTokens.map((t) => `${t}*`).join(" ");
        const ftsRes = await db.execute({
          sql: `
            SELECT s.id, s.title, s.artist, s.album_cover,
              bm25(songs_fts, 5.0, 2.0, 1.0) as bm_rank
            FROM songs_fts
            JOIN songs s ON songs_fts.id = s.id
            WHERE songs_fts MATCH ?
              AND (s.is_active = 1 OR s.is_active IS NULL)
            ORDER BY bm_rank ASC, s.deezer_rank DESC
            LIMIT 10;
          `,
          args: [ftsQuery],
        });

        if (ftsRes.rows.length > 0) {
          const results = ftsRes.rows.map((r: any) => ({
            id: String(r.id),
            title: String(r.title),
            artist: String(r.artist),
            albumCover: r.album_cover || "",
            matchType: "fts5",
          }));

          if (searchCache.size > 500) {
            const firstKey = searchCache.keys().next().value;
            if (firstKey) searchCache.delete(firstKey);
          }
          searchCache.set(queryLower, results);

          return NextResponse.json({ results });
        }
      } catch (ftsErr) {
        console.warn("FTS5 query failed, falling back to LIKE:", ftsErr);
      }
    }

    // 2. FALLBACK PATH: Standard SQL LIKE for non-tokenized or edge symbols
    const starts = `${queryLower}%`;
    const contains = `%${queryLower}%`;
    const tokenArgs = cleanTokens.map((t) => `%${t}%`);
    const whereConditions = cleanTokens
      .map(() => "(LOWER(title || ' ' || artist || ' ' || COALESCE(search_query, '')) LIKE ?)")
      .join(" AND ");

    const fallbackRes = await db.execute({
      sql: `
        SELECT id, title, artist, album_cover
        FROM songs
        WHERE (is_active = 1 OR is_active IS NULL)
          AND (${whereConditions || "1=1"})
        ORDER BY 
          CASE 
            WHEN LOWER(title) = ? THEN 1000
            WHEN LOWER(artist) = ? THEN 800
            WHEN LOWER(title) LIKE ? THEN 600
            ELSE 100
          END DESC,
          deezer_rank DESC,
          times_played DESC
        LIMIT 10;
      `,
      args: [queryLower, queryLower, starts, ...tokenArgs],
    });

    const results = fallbackRes.rows.map((r: any) => ({
      id: String(r.id),
      title: String(r.title),
      artist: String(r.artist),
      albumCover: r.album_cover || "",
      matchType: "like_fallback",
    }));

    if (searchCache.size > 500) {
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
