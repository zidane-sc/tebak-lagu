import { NextResponse } from "next/server";
import { SONGS_CATALOG } from "../../../../data/songs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  // Filter local pool
  const pool = category && category !== "Semua Genre"
    ? SONGS_CATALOG.filter((s) => s.category === category)
    : SONGS_CATALOG;
  const activePool = pool.length > 0 ? pool : SONGS_CATALOG;

  // Pick random song
  const baseSong = activePool[Math.floor(Math.random() * activePool.length)];

  // Random timestamp: System generates a random offset (e.g. 0 to 18 seconds)
  // so the player hears a completely different segment of the song each round!
  const randomOffset = Math.floor(Math.random() * 15);

  return NextResponse.json({
    song: {
      ...baseSong,
      startSecond: randomOffset,
    },
    randomOffset,
  });
}
