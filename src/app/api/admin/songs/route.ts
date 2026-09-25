import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const songsFilePath = path.join(process.cwd(), "src/data/songs.json");

// Helper to read catalog with fallback
function readCatalog(): any[] {
  try {
    if (fs.existsSync(songsFilePath)) {
      const raw = fs.readFileSync(songsFilePath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e: any) {
    console.error("Error reading songs.json:", e.message);
  }
  return [];
}

// Helper to write catalog safely
function writeCatalog(catalog: any[]): boolean {
  try {
    fs.writeFileSync(songsFilePath, JSON.stringify(catalog, null, 2), "utf-8");
    return true;
  } catch (e: any) {
    console.error("Error writing songs.json:", e.message);
    return false;
  }
}

// Compute statistics across catalog
function computeStats(catalog: any[]) {
  const byDifficulty: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  const byCategory: Record<string, number> = {};

  for (const s of catalog) {
    const d = s.difficulty || "easy";
    byDifficulty[d] = (byDifficulty[d] || 0) + 1;

    const c = s.category || "Lainnya";
    byCategory[c] = (byCategory[c] || 0) + 1;
  }

  return {
    total: catalog.length,
    easy: byDifficulty.easy || 0,
    medium: byDifficulty.medium || 0,
    hard: byDifficulty.hard || 0,
    byCategory,
  };
}

// GET: Paginated list & search
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(5, Math.min(100, parseInt(searchParams.get("limit") || "30", 10)));
  const search = (searchParams.get("search") || "").toLowerCase().trim();
  const category = searchParams.get("category");
  const difficulty = searchParams.get("difficulty");

  const catalog = readCatalog();
  const stats = computeStats(catalog);

  let filtered = catalog;

  if (category && category !== "all" && category !== "Semua Genre") {
    filtered = filtered.filter((s) => s.category === category);
  }

  if (difficulty && difficulty !== "all") {
    filtered = filtered.filter((s) => s.difficulty === difficulty);
  }

  if (search) {
    filtered = filtered.filter(
      (s) =>
        s.title.toLowerCase().includes(search) ||
        s.artist.toLowerCase().includes(search)
    );
  }

  const filteredTotal = filtered.length;
  const totalPages = Math.ceil(filteredTotal / limit) || 1;
  const offset = (page - 1) * limit;
  const pagedSongs = filtered.slice(offset, offset + limit);

  return NextResponse.json({
    total: catalog.length,
    filteredTotal,
    page,
    limit,
    totalPages,
    stats,
    songs: pagedSongs,
  });
}

// POST: Add new song
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, artist, category, difficulty, year, previewUrl, albumCover } = body;

    if (!title?.trim() || !artist?.trim()) {
      return NextResponse.json(
        { error: "Judul dan Nama Artis wajib diisi!" },
        { status: 400 }
      );
    }

    const catalog = readCatalog();
    const cleanId = `${artist}-${title}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const newSong = {
      id: `${cleanId}-${Date.now().toString(36)}`,
      title: title.trim(),
      artist: artist.trim(),
      year: parseInt(year, 10) || new Date().getFullYear(),
      category: category || "Galau Hits",
      difficulty: difficulty || "easy",
      popularity: body.popularity || (difficulty === "easy" ? 90 : difficulty === "medium" ? 75 : 50),
      startSecond: body.startSecond || 0,
      lyricsClues: body.lyricsClues && body.lyricsClues.length > 0 ? body.lyricsClues : [
        `Lagu populer dari ${artist.trim()}`,
        `Rilis tahun ${year || 2020}`
      ],
      hummingMelody: [
        { note: 330, duration: 0.4 },
        { note: 370, duration: 0.4 },
        { note: 392, duration: 0.5 }
      ],
      searchQuery: `${title.trim()} ${artist.trim()}`,
      previewUrl: previewUrl || "",
      previewResolved: previewUrl || "",
      albumCover: albumCover || ""
    };

    catalog.unshift(newSong);
    const saved = writeCatalog(catalog);

    if (!saved) {
      return NextResponse.json({ error: "Gagal menyimpan file katalog!" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menambahkan lagu "${newSong.title}" - ${newSong.artist}`,
      song: newSong,
      total: catalog.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: Edit existing song
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, title, artist, category, difficulty, year, popularity, previewUrl, albumCover } = body;

    if (!id) {
      return NextResponse.json({ error: "ID lagu wajib disertakan!" }, { status: 400 });
    }

    const catalog = readCatalog();
    const index = catalog.findIndex((s) => s.id === id);

    if (index === -1) {
      return NextResponse.json({ error: "Lagu tidak ditemukan!" }, { status: 404 });
    }

    const existing = catalog[index];
    catalog[index] = {
      ...existing,
      title: title !== undefined ? title.trim() : existing.title,
      artist: artist !== undefined ? artist.trim() : existing.artist,
      category: category || existing.category,
      difficulty: difficulty || existing.difficulty,
      year: year !== undefined ? parseInt(year, 10) : existing.year,
      popularity: popularity !== undefined ? parseInt(popularity, 10) : existing.popularity,
      previewUrl: previewUrl !== undefined ? previewUrl : existing.previewUrl,
      previewResolved: previewUrl !== undefined ? previewUrl : existing.previewResolved,
      albumCover: albumCover !== undefined ? albumCover : existing.albumCover,
      searchQuery: `${title || existing.title} ${artist || existing.artist}`,
    };

    const saved = writeCatalog(catalog);
    if (!saved) {
      return NextResponse.json({ error: "Gagal menyimpan perubahan ke katalog!" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil memperbarui lagu "${catalog[index].title}"`,
      song: catalog[index],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Delete song from catalog
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Parameter ID lagu wajib diisi!" }, { status: 400 });
    }

    const catalog = readCatalog();
    const initialLen = catalog.length;
    const updated = catalog.filter((s) => s.id !== id);

    if (updated.length === initialLen) {
      return NextResponse.json({ error: "Lagu dengan ID tersebut tidak ditemukan!" }, { status: 404 });
    }

    const saved = writeCatalog(updated);
    if (!saved) {
      return NextResponse.json({ error: "Gagal menyimpan penghapusan!" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Lagu berhasil dihapus dari katalog.",
      total: updated.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
