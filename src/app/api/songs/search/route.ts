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
    // 1. Instant local DB matches
    const term = `%${queryLower}%`;
    const localRes = await db.execute({
      sql: "SELECT * FROM songs WHERE title LIKE ? OR artist LIKE ? LIMIT 6;",
      args: [term, term],
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
