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
      SELECT *,
        ${relevanceSql}
      FROM songs
      WHERE ${whereConditions}
      ORDER BY relevance DESC, popularity DESC, deezer_rank DESC
      LIMIT 10;
    `;

    const localRes = await db.execute({
      sql,
      args: [...relevanceArgs, ...tokenArgs],
    });

    const localMatches = localRes.rows.map(rowToSong);

    // 2. Fast background search from online directory with strict 1.2s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
      q
    )}&entity=song&limit=10`;

    const res = await fetch(itunesUrl, {
      headers: { "User-Agent": "TebakLagu/2.0" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    let onlineResults: any[] = [];
    if (res.ok) {
      const data = await res.json();
      onlineResults = (data.results || []).map((r: any) => ({
        id: `itunes-${r.trackId}`,
        title: r.trackName,
        artist: r.artistName,
        year: r.releaseDate ? new Date(r.releaseDate).getFullYear() : 2020,
        category: r.primaryGenreName || "Music",
        albumCover: r.artworkUrl100,
        previewUrl: r.previewUrl,
        searchQuery: `${r.trackName} ${r.artistName}`,
      }));
    }

    // Merge: local DB matches first, then online results (deduped by title + artist)
    const seen = new Set<string>();
    const combined: any[] = [];

    for (const s of localMatches) {
      if (!s) continue;
      const key = `${s.title.toLowerCase().trim()}::${s.artist.toLowerCase().trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push({
          id: s.id,
          title: s.title,
          artist: s.artist,
          year: s.year,
          category: s.category,
          albumCover: s.albumCover,
          previewUrl: s.previewUrl,
          searchQuery: s.searchQuery,
          source: "local_db",
        });
      }
    }

    for (const s of onlineResults) {
      const key = `${s.title.toLowerCase().trim()}::${s.artist.toLowerCase().trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push({ ...s, source: "itunes" });
      }
    }

    if (searchCache.size > 200) {
      const firstKey = searchCache.keys().next().value;
      if (firstKey) searchCache.delete(firstKey);
    }
    searchCache.set(queryLower, combined);

    return NextResponse.json({ results: combined });
  } catch (err: any) {
    console.error("Search error:", err);
    return NextResponse.json({ results: [] });
  }
}
