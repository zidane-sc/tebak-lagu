import { NextResponse } from "next/server";
import { SONGS_CATALOG } from "../../../../data/songs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const difficulty = searchParams.get("difficulty");
  const mode = searchParams.get("mode");

  // Filter local pool by category and difficulty
  let pool = SONGS_CATALOG;
  if (category && category !== "Semua Genre") {
    pool = pool.filter((s) => s.category === category);
  }
  if (difficulty && difficulty !== "all") {
    const diffFiltered = pool.filter((s) => s.difficulty === difficulty);
    if (diffFiltered.length > 0) pool = diffFiltered;
  }
  const activePool = pool.length > 0 ? pool : SONGS_CATALOG;

  // Pick random song
  let baseSong = activePool[Math.floor(Math.random() * activePool.length)];

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

      // Try another song from pool
      baseSong = activePool[Math.floor(Math.random() * activePool.length)];
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
}
