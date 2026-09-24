import { NextResponse } from "next/server";
import { SONGS_CATALOG } from "@/data/songs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  const random = searchParams.get("random") === "true";

  // For autocomplete options: return title, artist, year, id
  const search = searchParams.get("search");
  if (search) {
    const q = search.toLowerCase();
    const results = SONGS_CATALOG.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q)
    ).map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      year: s.year,
      display: `${s.title} - ${s.artist}`,
    }));
    return NextResponse.json({ results });
  }

  // Pick random song
  if (random) {
    const randomIndex = Math.floor(Math.random() * SONGS_CATALOG.length);
    const song = SONGS_CATALOG[randomIndex];
    return NextResponse.json({
      song: {
        id: song.id,
        year: song.year,
        category: song.category,
        lyricsClues: song.lyricsClues,
        hummingMelody: song.hummingMelody,
        searchQuery: song.searchQuery,
        previewFallback: song.previewFallback,
        // Answer is concealed or exposed depending on game loop
        title: song.title,
        artist: song.artist,
      },
    });
  }

  // Default: return all catalog
  return NextResponse.json({
    total: SONGS_CATALOG.length,
    songs: SONGS_CATALOG.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      year: s.year,
      category: s.category,
    })),
  });
}
