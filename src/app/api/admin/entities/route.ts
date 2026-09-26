import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "artists";
    const search = searchParams.get("search")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(5, Math.min(100, parseInt(searchParams.get("limit") || "30", 10)));
    const offset = (page - 1) * limit;

    // -----------------------------------------------------------
    // 1. ARTISTS LIST
    // -----------------------------------------------------------
    if (type === "artists") {
      let whereClause = "";
      const args: any[] = [];

      if (search) {
        whereClause = "WHERE artist LIKE ?";
        args.push(`%${search}%`);
      }

      const totalRes = await db.execute({
        sql: `SELECT COUNT(DISTINCT artist) as total FROM songs ${whereClause};`,
        args,
      });
      const total = Number(totalRes.rows[0]?.total || 0);

      const artistsRes = await db.execute({
        sql: `
          SELECT 
            artist,
            COUNT(*) as song_count,
            SUM(times_played) as total_plays,
            SUM(times_guessed) as total_guesses,
            MAX(album_cover) as sample_cover,
            GROUP_CONCAT(DISTINCT category) as categories,
            MIN(year) as min_year,
            MAX(year) as max_year,
            MAX(deezer_rank) as top_deezer_rank
          FROM songs
          ${whereClause}
          GROUP BY artist
          ORDER BY song_count DESC, total_plays DESC
          LIMIT ? OFFSET ?;
        `,
        args: [...args, limit, offset],
      });

      const artists = artistsRes.rows.map((r: any) => ({
        artist: String(r.artist),
        song_count: Number(r.song_count || 0),
        total_plays: Number(r.total_plays || 0),
        total_guesses: Number(r.total_guesses || 0),
        sample_cover: r.sample_cover || "",
        categories: r.categories ? String(r.categories).split(",") : [],
        min_year: r.min_year ? Number(r.min_year) : null,
        max_year: r.max_year ? Number(r.max_year) : null,
        top_deezer_rank: Number(r.top_deezer_rank || 0),
      }));

      return NextResponse.json({
        type: "artists",
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
        artists,
      });
    }

    // -----------------------------------------------------------
    // 2. GENRES LIST
    // -----------------------------------------------------------
    if (type === "genres") {
      const genresRes = await db.execute(`
        SELECT 
          category,
          COUNT(*) as song_count,
          SUM(times_played) as total_plays,
          SUM(times_guessed) as total_guesses,
          SUM(CASE WHEN difficulty = 'easy' THEN 1 ELSE 0 END) as easy_count,
          SUM(CASE WHEN difficulty = 'medium' THEN 1 ELSE 0 END) as medium_count,
          SUM(CASE WHEN difficulty = 'hard' THEN 1 ELSE 0 END) as hard_count,
          MAX(album_cover) as sample_cover
        FROM songs
        GROUP BY category
        ORDER BY song_count DESC;
      `);

      const genres = genresRes.rows.map((r: any) => ({
        category: String(r.category),
        song_count: Number(r.song_count || 0),
        total_plays: Number(r.total_plays || 0),
        total_guesses: Number(r.total_guesses || 0),
        easy_count: Number(r.easy_count || 0),
        medium_count: Number(r.medium_count || 0),
        hard_count: Number(r.hard_count || 0),
        sample_cover: r.sample_cover || "",
      }));

      return NextResponse.json({ type: "genres", genres });
    }

    // -----------------------------------------------------------
    // 3. ALBUMS LIST
    // -----------------------------------------------------------
    if (type === "albums") {
      let whereClause = "";
      const args: any[] = [];

      if (search) {
        whereClause = "WHERE (album LIKE ? OR artist LIKE ?)";
        args.push(`%${search}%`, `%${search}%`);
      }

      const totalRes = await db.execute({
        sql: `
          SELECT COUNT(*) as total FROM (
            SELECT COALESCE(NULLIF(album, ''), 'Single / Belum Ada Album') as album_name, artist
            FROM songs
            ${whereClause}
            GROUP BY album_name, artist
          );
        `,
        args,
      });
      const total = Number(totalRes.rows[0]?.total || 0);

      const albumsRes = await db.execute({
        sql: `
          SELECT 
            COALESCE(NULLIF(album, ''), 'Single / Belum Ada Album') as album_name,
            artist,
            MIN(year) as year,
            MAX(album_cover) as album_cover,
            COUNT(*) as track_count,
            SUM(times_played) as total_plays,
            GROUP_CONCAT(DISTINCT category) as categories
          FROM songs
          ${whereClause}
          GROUP BY album_name, artist
          ORDER BY track_count DESC, total_plays DESC
          LIMIT ? OFFSET ?;
        `,
        args: [...args, limit, offset],
      });

      const albums = albumsRes.rows.map((r: any) => ({
        album_name: String(r.album_name),
        artist: String(r.artist),
        year: r.year ? Number(r.year) : null,
        album_cover: r.album_cover || "",
        track_count: Number(r.track_count || 0),
        total_plays: Number(r.total_plays || 0),
        categories: r.categories ? String(r.categories).split(",") : [],
      }));

      return NextResponse.json({
        type: "albums",
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
        albums,
      });
    }

    // -----------------------------------------------------------
    // 4. SONGS BY ARTIST OR ALBUM
    // -----------------------------------------------------------
    if (type === "songs_by_artist") {
      const artist = searchParams.get("artist") || "";
      const res = await db.execute({
        sql: "SELECT id, title, artist, year, category, difficulty, album, album_cover, preview_url, deezer_rank, bpm, times_played FROM songs WHERE artist = ? ORDER BY year DESC, title ASC;",
        args: [artist],
      });
      return NextResponse.json({ artist, songs: res.rows });
    }

    if (type === "songs_by_album") {
      const artist = searchParams.get("artist") || "";
      const album = searchParams.get("album") || "";

      let sql = "";
      let args: any[] = [];

      if (album === "Single / Belum Ada Album" || !album) {
        sql = "SELECT id, title, artist, year, category, difficulty, album, album_cover, preview_url, deezer_rank, bpm, times_played FROM songs WHERE artist = ? AND (album IS NULL OR album = '') ORDER BY title ASC;";
        args = [artist];
      } else {
        sql = "SELECT id, title, artist, year, category, difficulty, album, album_cover, preview_url, deezer_rank, bpm, times_played FROM songs WHERE artist = ? AND album = ? ORDER BY title ASC;";
        args = [artist, album];
      }

      const res = await db.execute({ sql, args });
      return NextResponse.json({ artist, album, songs: res.rows });
    }

    return NextResponse.json({ error: "Invalid type param" }, { status: 400 });
  } catch (err: any) {
    console.error("GET /api/admin/entities error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json();
    const { action } = body;

    // 1. RENAME ARTIST (Batch across all songs)
    if (action === "rename_artist") {
      const { oldName, newName } = body;
      if (!oldName?.trim() || !newName?.trim()) {
        return NextResponse.json({ error: "Nama lama dan nama baru wajib diisi!" }, { status: 400 });
      }

      const updateRes = await db.execute({
        sql: "UPDATE songs SET artist = ?, search_query = title || ' ' || ? WHERE artist = ?;",
        args: [newName.trim(), newName.trim(), oldName.trim()],
      });

      return NextResponse.json({
        success: true,
        message: `Berhasil mengubah nama penyanyi dari "${oldName}" menjadi "${newName}" pada ${updateRes.rowsAffected || 0} lagu.`,
      });
    }

    // 2. REASSIGN ARTIST GENRE
    if (action === "reassign_artist_genre") {
      const { artist, newCategory } = body;
      if (!artist?.trim() || !newCategory?.trim()) {
        return NextResponse.json({ error: "Artis dan genre baru wajib diisi!" }, { status: 400 });
      }

      const updateRes = await db.execute({
        sql: "UPDATE songs SET category = ? WHERE artist = ?;",
        args: [newCategory.trim(), artist.trim()],
      });

      return NextResponse.json({
        success: true,
        message: `Berhasil memindahkan seluruh lagu "${artist}" ke genre "${newCategory}".`,
      });
    }

    // 3. RENAME OR MERGE GENRE
    if (action === "rename_genre") {
      const { oldCategory, newCategory } = body;
      if (!oldCategory?.trim() || !newCategory?.trim()) {
        return NextResponse.json({ error: "Genre lama dan genre baru wajib diisi!" }, { status: 400 });
      }

      const updateRes = await db.execute({
        sql: "UPDATE songs SET category = ? WHERE category = ?;",
        args: [newCategory.trim(), oldCategory.trim()],
      });

      return NextResponse.json({
        success: true,
        message: `Berhasil memperbarui genre "${oldCategory}" menjadi "${newCategory}" (${updateRes.rowsAffected || 0} lagu).`,
      });
    }

    // 4. BATCH UPDATE ALBUM (Name, Year, Cover)
    if (action === "update_album") {
      const { artist, oldAlbumName, newAlbumName, newCover, newYear } = body;
      if (!artist?.trim() || !newAlbumName?.trim()) {
        return NextResponse.json({ error: "Artis dan nama album baru wajib diisi!" }, { status: 400 });
      }

      let whereClause = "artist = ? AND album = ?";
      if (oldAlbumName === "Single / Belum Ada Album" || !oldAlbumName) {
        whereClause = "artist = ? AND (album IS NULL OR album = '')";
      }

      let sql = `UPDATE songs SET album = ?`;
      const args: any[] = [newAlbumName.trim()];

      if (newCover) {
        sql += `, album_cover = ?`;
        args.push(newCover.trim());
      }
      if (newYear) {
        sql += `, year = ?`;
        args.push(parseInt(newYear, 10));
      }

      sql += ` WHERE ${whereClause};`;
      args.push(artist.trim());
      if (oldAlbumName !== "Single / Belum Ada Album" && oldAlbumName) {
        args.push(oldAlbumName.trim());
      }

      const updateRes = await db.execute({ sql, args });

      return NextResponse.json({
        success: true,
        message: `Berhasil memperbarui data album "${newAlbumName}" (${updateRes.rowsAffected || 0} lagu).`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/admin/entities error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
