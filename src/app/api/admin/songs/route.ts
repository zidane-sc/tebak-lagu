import { NextResponse } from "next/server";
import { db, getSongsPaged, initDb, rowToSong } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET: Paginated list & search from persistent database
export async function GET(request: Request) {
  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(5, Math.min(100, parseInt(searchParams.get("limit") || "25", 10)));
    const search = searchParams.get("search") || undefined;
    const category = searchParams.get("category") || undefined;
    const difficulty = searchParams.get("difficulty") || undefined;

    const data = await getSongsPaged({
      page,
      limit,
      search,
      category,
      difficulty,
    });

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Admin songs GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Add new song to persistent database
export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json();
    const { title, artist, category, difficulty, year, previewUrl, albumCover } = body;

    if (!title?.trim() || !artist?.trim()) {
      return NextResponse.json(
        { error: "Judul dan Nama Artis wajib diisi!" },
        { status: 400 }
      );
    }

    const cleanId = `${artist}-${title}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const songId = `${cleanId}-${Date.now().toString(36)}`;

    // Validate and fetch lyrics from LRCLIB
    let lyricsClues: string[] = body.lyricsClues && body.lyricsClues.length > 0 ? body.lyricsClues : [];

    if (lyricsClues.length === 0) {
      try {
        const lrclibUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(
          artist.trim()
        )}&track_name=${encodeURIComponent(title.trim())}`;
        const res = await fetch(lrclibUrl, { headers: { "User-Agent": "TebakLagu/3.0" } });
        if (res.ok) {
          const lData = await res.json();
          const rawText = lData.plainLyrics || lData.syncedLyrics || "";
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
                lyricsClues = clues;
              }
            }
          }
        }
      } catch (e) {}
    }

    if (!lyricsClues || lyricsClues.length === 0) {
      return NextResponse.json(
        {
          error: `Validasi gagal: Lirik untuk "${title}" - ${artist} tidak ditemukan di database LRCLIB! Robot TTS memerlukan lirik asli agar dapat dimainkan.`,
        },
        { status: 422 }
      );
    }

    const hummingMelody = [];

    const searchQuery = `${title.trim()} ${artist.trim()}`;
    const popularity = body.popularity || (difficulty === "easy" ? 90 : difficulty === "medium" ? 75 : 50);
    const startSecond = body.startSecond !== undefined ? Number(body.startSecond) : 0;

    await db.execute({
      sql: `
        INSERT OR REPLACE INTO songs (
          id, title, artist, year, category, difficulty, popularity,
          preview_url, album_cover, lyrics_clues, humming_melody, search_query, start_second
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      args: [
        songId,
        title.trim(),
        artist.trim(),
        parseInt(year, 10) || new Date().getFullYear(),
        category || "Galau Hits",
        difficulty || "easy",
        popularity,
        previewUrl || "",
        albumCover || "",
        JSON.stringify(lyricsClues),
        JSON.stringify(hummingMelody),
        searchQuery,
        startSecond,
      ],
    });

    const res = await db.execute({
      sql: "SELECT * FROM songs WHERE id = ?;",
      args: [songId],
    });

    const createdSong = rowToSong(res.rows[0]);

    return NextResponse.json({
      success: true,
      message: `Berhasil menambahkan lagu "${title}" - ${artist}`,
      song: createdSong,
    });
  } catch (err: any) {
    console.error("Admin songs POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: Edit existing song in persistent database
export async function PUT(request: Request) {
  try {
    await initDb();
    const body = await request.json();
    const {
      id,
      title,
      artist,
      category,
      difficulty,
      year,
      popularity,
      previewUrl,
      albumCover,
      startSecond,
      lyricsClues,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "ID lagu wajib disertakan!" }, { status: 400 });
    }

    const check = await db.execute({
      sql: "SELECT * FROM songs WHERE id = ?;",
      args: [id],
    });

    if (check.rows.length === 0) {
      return NextResponse.json({ error: "Lagu tidak ditemukan!" }, { status: 404 });
    }

    const existing = rowToSong(check.rows[0]);
    const updatedTitle = title !== undefined ? title.trim() : existing.title;
    const updatedArtist = artist !== undefined ? artist.trim() : existing.artist;
    const updatedYear = year !== undefined ? parseInt(year, 10) : existing.year;
    const updatedCategory = category || existing.category;
    const updatedDifficulty = difficulty || existing.difficulty;
    const updatedPopularity = popularity !== undefined ? parseInt(popularity, 10) : existing.popularity;
    const updatedPreview = previewUrl !== undefined ? previewUrl : existing.previewUrl;
    const updatedCover = albumCover !== undefined ? albumCover : existing.albumCover;
    const updatedStartSecond = startSecond !== undefined ? Number(startSecond) : existing.startSecond || 0;
    const updatedLyricsClues = lyricsClues !== undefined ? JSON.stringify(lyricsClues) : JSON.stringify(existing.lyricsClues || []);
    const searchQuery = `${updatedTitle} ${updatedArtist}`;

    await db.execute({
      sql: `
        UPDATE songs SET
          title = ?,
          artist = ?,
          year = ?,
          category = ?,
          difficulty = ?,
          popularity = ?,
          preview_url = ?,
          album_cover = ?,
          search_query = ?,
          start_second = ?,
          lyrics_clues = ?
        WHERE id = ?;
      `,
      args: [
        updatedTitle,
        updatedArtist,
        updatedYear,
        updatedCategory,
        updatedDifficulty,
        updatedPopularity,
        updatedPreview,
        updatedCover,
        searchQuery,
        updatedStartSecond,
        updatedLyricsClues,
        id,
      ],
    });

    const refreshed = await db.execute({
      sql: "SELECT * FROM songs WHERE id = ?;",
      args: [id],
    });

    return NextResponse.json({
      success: true,
      message: `Berhasil memperbarui lagu "${updatedTitle}"`,
      song: rowToSong(refreshed.rows[0]),
    });
  } catch (err: any) {
    console.error("Admin songs PUT error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Delete song from persistent database
export async function DELETE(request: Request) {
  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Parameter ID lagu wajib diisi!" }, { status: 400 });
    }

    const check = await db.execute({
      sql: "SELECT title, artist FROM songs WHERE id = ?;",
      args: [id],
    });

    if (check.rows.length === 0) {
      return NextResponse.json({ error: "Lagu dengan ID tersebut tidak ditemukan!" }, { status: 404 });
    }

    await db.execute({
      sql: "DELETE FROM songs WHERE id = ?;",
      args: [id],
    });

    return NextResponse.json({
      success: true,
      message: `Lagu "${check.rows[0].title}" berhasil dihapus dari database.`,
    });
  } catch (err: any) {
    console.error("Admin songs DELETE error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
