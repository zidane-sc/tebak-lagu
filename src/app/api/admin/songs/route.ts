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

    const lyricsClues = body.lyricsClues && body.lyricsClues.length > 0 ? body.lyricsClues : [
      `Lagu populer dari ${artist.trim()}`,
      `Rilis tahun ${year || 2024}`,
    ];

    const hummingMelody = [
      { note: 330, duration: 0.4 },
      { note: 370, duration: 0.4 },
      { note: 392, duration: 0.5 },
    ];

    const searchQuery = `${title.trim()} ${artist.trim()}`;
    const popularity = body.popularity || (difficulty === "easy" ? 90 : difficulty === "medium" ? 75 : 50);

    await db.execute({
      sql: `
        INSERT OR REPLACE INTO songs (
          id, title, artist, year, category, difficulty, popularity,
          preview_url, album_cover, lyrics_clues, humming_melody, search_query
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
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
    const { id, title, artist, category, difficulty, year, popularity, previewUrl, albumCover } = body;

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
          search_query = ?
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
