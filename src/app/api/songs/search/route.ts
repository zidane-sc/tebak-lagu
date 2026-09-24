import { NextResponse } from "next/server";
import { SONGS_CATALOG } from "../../../../data/songs";

// In-memory cache for ultra-fast repeated queries (0ms)
const searchCache = new Map<string, any[]>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const queryLower = q.toLowerCase();

  // 1. Instant local matches (0ms response)
  const localMatches = SONGS_CATALOG.filter(
    (s) =>
      s.title.toLowerCase().includes(queryLower) ||
      s.artist.toLowerCase().includes(queryLower)
  ).slice(0, 6);

  // Check in-memory cache
  if (searchCache.has(queryLower)) {
    return NextResponse.json({ results: searchCache.get(queryLower) });
  }

  // 2. Fast background search from online directory with strict 1.2s timeout
  try {
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

    if (res.ok) {
      const data = await res.json();
      const onlineResults = (data.results || []).map((r: any) => ({
        id: `itunes-${r.trackId}`,
        title: r.trackName,
        artist: r.artistName,
        year: r.releaseDate ? new Date(r.releaseDate).getFullYear() : 2020,
        category: r.primaryGenreName || "Music",
        albumCover: r.artworkUrl100,
        previewUrl: r.previewUrl,
        searchQuery: `${r.trackName} ${r.artistName}`,
      }));

      // Combine local matches first, then online results
      const combined = [...localMatches];
      const seen = new Set(
        localMatches.map((m) => `${m.title.toLowerCase()}::${m.artist.toLowerCase()}`)
      );

      for (const item of onlineResults) {
        const key = `${item.title.toLowerCase()}::${item.artist.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(item);
        }
        if (combined.length >= 8) break;
      }

      // Cache up to 200 queries
      if (searchCache.size > 200) {
        const firstKey = searchCache.keys().next().value;
        if (firstKey) searchCache.delete(firstKey);
      }
      searchCache.set(queryLower, combined);

      return NextResponse.json({ results: combined });
    }
  } catch (err) {
    // If external search timed out or failed, instantly return local matches!
  }

  return NextResponse.json({ results: localMatches });
}
