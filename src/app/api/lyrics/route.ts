import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get("artist");
  const track = searchParams.get("track");

  if (!artist || !track) {
    return NextResponse.json({ error: "Missing artist or track" }, { status: 400 });
  }

  try {
    const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(track)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "TebakLaguApp/1.0" },
    });

    if (!res.ok) {
      // Fallback search
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${track}`)}`;
      const searchRes = await fetch(searchUrl, {
        headers: { "User-Agent": "TebakLaguApp/1.0" },
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (Array.isArray(searchData) && searchData.length > 0) {
          return NextResponse.json({
            plainLyrics: searchData[0].plainLyrics,
            syncedLyrics: searchData[0].syncedLyrics,
            lines: (searchData[0].plainLyrics || "").split("\n").filter((l: string) => l.trim().length > 0)
          });
        }
      }
      return NextResponse.json({ error: "Lyrics not found" }, { status: 404 });
    }

    const data = await res.json();
    const plain = data.plainLyrics || "";
    const lines = plain.split("\n").filter((l: string) => l.trim().length > 0);

    return NextResponse.json({
      plainLyrics: plain,
      syncedLyrics: data.syncedLyrics,
      lines: lines,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch lyrics" }, { status: 500 });
  }
}
