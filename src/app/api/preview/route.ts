import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    // 1. Try Deezer Search API
    const deezerUrl = `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=3`;
    const dRes = await fetch(deezerUrl, {
      headers: { "User-Agent": "TebakLaguApp/1.0" },
    });

    if (dRes.ok) {
      const dData = await dRes.json();
      if (Array.isArray(dData.data) && dData.data.length > 0) {
        const item = dData.data[0];
        if (item.preview) {
          return NextResponse.json({
            previewUrl: item.preview,
            albumCover: item.album?.cover_medium || item.album?.cover_big,
            title: item.title,
            artist: item.artist?.name,
            source: "deezer",
          });
        }
      }
    }

    // 2. Fallback to Apple iTunes Search API
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=3`;
    const iRes = await fetch(itunesUrl, {
      headers: { "User-Agent": "TebakLaguApp/1.0" },
    });

    if (iRes.ok) {
      const iData = await iRes.json();
      if (Array.isArray(iData.results) && iData.results.length > 0) {
        const item = iData.results[0];
        if (item.previewUrl) {
          return NextResponse.json({
            previewUrl: item.previewUrl,
            albumCover: item.artworkUrl100?.replace("100x100bb", "600x600bb"),
            title: item.trackName,
            artist: item.artistName,
            source: "itunes",
          });
        }
      }
    }

    return NextResponse.json({ error: "No preview found" }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch preview" }, { status: 500 });
  }
}
