import { NextResponse } from "next/server";
import { initDb, getRandomSong } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const difficulty = searchParams.get("difficulty");
    const mode = searchParams.get("mode");

    // Query database directly
    let baseSong = await getRandomSong(category, difficulty);

    if (!baseSong) {
      return NextResponse.json({ error: "Lagu tidak ditemukan" }, { status: 404 });
    }

    // For TTS mode, resolve real lyrics on-the-fly if needed
    if (mode === "tts") {
      let lyricsFound = false;
      let attempts = 0;

      while (!lyricsFound && attempts < 4) {
        if (
          baseSong.lyricsClues &&
          baseSong.lyricsClues.length > 0 &&
          !baseSong.lyricsClues[0].toLowerCase().includes("tebak judul")
        ) {
          lyricsFound = true;
          break;
        }

        try {
          const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(
            baseSong.artist
          )}&track_name=${encodeURIComponent(baseSong.title)}`;
          const res = await fetch(url, { headers: { "User-Agent": "TebakLagu/3.0" } });
          if (res.ok) {
            const data = await res.json();
            const rawText = data.plainLyrics || data.syncedLyrics || "";
            if (rawText) {
              const cleanLines = rawText
                .split("\n")
                .map((l: string) => l.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "").trim())
                .filter((l: string) => l.length > 5 && !l.startsWith("[") && !l.endsWith("]"));

              if (cleanLines.length >= 2) {
                const clues = [];
                for (let i = 0; i < Math.min(6, cleanLines.length); i += 2) {
                  if (cleanLines[i + 1]) {
                    clues.push(`${cleanLines[i]}\n${cleanLines[i + 1]}`);
                  } else {
                    clues.push(cleanLines[i]);
                  }
                }
                if (clues.length > 0) {
                  baseSong = { ...baseSong, lyricsClues: clues };
                  lyricsFound = true;
                  break;
                }
              }
            }
          }
        } catch (e) {}

        // Pick another song from DB
        const next = await getRandomSong(category, difficulty);
        if (next) baseSong = next;
        attempts++;
      }
    }

    // Random timestamp for Heardle / Audio modes
    const randomOffset = Math.floor(Math.random() * 15);

    return NextResponse.json({
      song: {
        ...baseSong,
        startSecond: randomOffset,
      },
      randomOffset,
    });
  } catch (err: any) {
    console.error("API songs/random error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
