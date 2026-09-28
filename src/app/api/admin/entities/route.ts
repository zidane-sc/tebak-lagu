import { NextResponse } from "next/server";
import { db, initDb, getSettingsFromDb, saveSettingToDb } from "@/lib/db";
import { seedArtists } from "@/scripts/seed-artists";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "artists";
    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const minSongs = parseInt(searchParams.get("min_songs") || "0", 10);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(5, Math.min(100, parseInt(searchParams.get("limit") || "30", 10)));
    const offset = (page - 1) * limit;

    // -----------------------------------------------------------
    // 1. ARTISTS LIST (From Multi-Artist Normalized Table)
    // -----------------------------------------------------------
    if (type === "artists") {
      const conditions: string[] = [];
      const args: any[] = [];

      if (search) {
        conditions.push("a.name LIKE ?");
        args.push(`%${search}%`);
      }
      if (category && category !== "all" && category !== "Semua Playlist") {
        conditions.push("a.category = ?");
        args.push(category);
      }
      if (minSongs > 0) {
        conditions.push("a.song_count >= ?");
        args.push(minSongs);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const totalRes = await db.execute({
        sql: `SELECT COUNT(*) as total FROM artists a ${whereClause};`,
        args,
      });
      const total = Number(totalRes.rows[0]?.total || 0);

      const artistsRes = await db.execute({
        sql: `
          SELECT 
            a.id,
            a.name as artist,
            a.image as sample_cover,
            a.category as primary_category,
            a.song_count,
            COALESCE(a.is_active, 1) as is_active,
            COALESCE(SUM(s.times_played), 0) as total_plays,
            COALESCE(SUM(s.times_guessed), 0) as total_guesses,
            GROUP_CONCAT(DISTINCT s.category) as categories,
            MIN(s.year) as min_year,
            MAX(s.year) as max_year,
            MAX(s.deezer_rank) as top_deezer_rank
          FROM artists a
          LEFT JOIN song_artists sa ON a.id = sa.artist_id
          LEFT JOIN songs s ON sa.song_id = s.id
          ${whereClause}
          GROUP BY a.id
          ORDER BY a.song_count DESC, total_plays DESC
          LIMIT ? OFFSET ?;
        `,
        args: [...args, limit, offset],
      });

      const artists = artistsRes.rows.map((r: any) => ({
        id: String(r.id),
        artist: String(r.artist),
        song_count: Number(r.song_count || 0),
        is_active: Number(r.is_active ?? 1) === 1,
        total_plays: Number(r.total_plays || 0),
        total_guesses: Number(r.total_guesses || 0),
        sample_cover: r.sample_cover || "",
        categories: r.categories ? String(r.categories).split(",") : [r.primary_category || "Pop"],
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
      const settings = await getSettingsFromDb();
      const disabledGenres: string[] = Array.isArray(settings.disabled_genres) ? settings.disabled_genres : [];

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
        is_active: !disabledGenres.includes(String(r.category)),
      }));

      return NextResponse.json({ type: "genres", genres, disabled_genres: disabledGenres });
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
    // 4. SONGS BY ARTIST (Multi-Artist Aware Query)
    // -----------------------------------------------------------
    if (type === "songs_by_artist") {
      const artist = searchParams.get("artist") || "";

      // Query through song_artists junction table for full coverage (solo + collabs)
      const res = await db.execute({
        sql: `
          SELECT 
            s.id,
            s.title,
            s.artist,
            s.year,
            s.category,
            s.difficulty,
            s.album,
            s.album_cover,
            s.preview_url,
            s.deezer_rank,
            s.bpm,
            s.times_played,
            sa.role
          FROM song_artists sa
          JOIN songs s ON sa.song_id = s.id
          WHERE sa.artist_name = ? OR sa.artist_name LIKE ?
          ORDER BY s.year DESC, s.title ASC;
        `,
        args: [artist, `%${artist}%`],
      });

      return NextResponse.json({ artist, songs: res.rows });
    }

    // -----------------------------------------------------------
    // 5. SONGS BY ALBUM
    // -----------------------------------------------------------
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

    // 0. SINKRONISASI / SEED ARTISTS
    if (action === "sync_artists") {
      await seedArtists();
      return NextResponse.json({
        success: true,
        message: "Sinkronisasi & Seeding Multi-Artis berhasil dilakukan!",
      });
    }

    // 0.1 TOGGLE ARTIST ACTIVE STATUS
    if (action === "toggle_artist_status") {
      const { artistId, is_active } = body;
      if (!artistId) {
        return NextResponse.json({ error: "Parameter artistId wajib diisi!" }, { status: 400 });
      }

      const newActive = is_active ? 1 : 0;
      await db.execute({
        sql: "UPDATE artists SET is_active = ? WHERE id = ? OR name = ?;",
        args: [newActive, artistId, artistId],
      });

      return NextResponse.json({
        success: true,
        is_active: newActive === 1,
        message: `Status artis berhasil diubah menjadi ${newActive ? "Aktif 🟢" : "Nonaktif 🔴"}`,
      });
    }

    // 0.2 TOGGLE GENRE ACTIVE STATUS
    if (action === "toggle_genre_status") {
      const { genre, is_active } = body;
      if (!genre) {
        return NextResponse.json({ error: "Parameter genre wajib diisi!" }, { status: 400 });
      }

      const settings = await getSettingsFromDb();
      let disabledGenres: string[] = Array.isArray(settings.disabled_genres) ? settings.disabled_genres : [];

      if (!is_active) {
        if (!disabledGenres.includes(genre)) {
          disabledGenres.push(genre);
        }
      } else {
        disabledGenres = disabledGenres.filter((g) => g !== genre);
      }

      await saveSettingToDb("disabled_genres", disabledGenres);

      return NextResponse.json({
        success: true,
        is_active: !!is_active,
        disabled_genres: disabledGenres,
        message: `Genre "${genre}" berhasil diubah menjadi ${is_active ? "Aktif 🟢" : "Nonaktif 🔴 (Tidak muncul di kuis)"}`,
      });
    }

    // 1. RENAME ARTIST (Batch across all songs and junction tables)
    if (action === "rename_artist") {
      const { oldName, newName } = body;
      if (!oldName?.trim() || !newName?.trim()) {
        return NextResponse.json({ error: "Nama lama dan nama baru wajib diisi!" }, { status: 400 });
      }

      // Update artists table
      await db.execute({
        sql: "UPDATE artists SET name = ? WHERE name = ?;",
        args: [newName.trim(), oldName.trim()],
      });

      // Update song_artists
      await db.execute({
        sql: "UPDATE song_artists SET artist_name = ? WHERE artist_name = ?;",
        args: [newName.trim(), oldName.trim()],
      });

      // Update songs display string
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

      // Update songs
      const updateRes = await db.execute({
        sql: "UPDATE songs SET category = ? WHERE artist = ?;",
        args: [newCategory.trim(), artist.trim()],
      });

      // Update artists
      await db.execute({
        sql: "UPDATE artists SET category = ? WHERE name = ?;",
        args: [newCategory.trim(), artist.trim()],
      });

      return NextResponse.json({
        success: true,
        message: `Berhasil memindahkan seluruh lagu "${artist}" ke genre "${newCategory}".`,
      });
    }

    // 3. DELETE ALL SONGS BY ARTIST
    if (action === "delete_artist_songs") {
      const { artist, mode: purgeMode } = body;
      if (!artist?.trim()) {
        return NextResponse.json({ error: "Nama artis wajib diisi!" }, { status: 400 });
      }

      const usePurge = purgeMode === "purge";

      // Collect song IDs from BOTH sources: the junction table and the plain
      // `songs.artist` string (which is what solo/multiplayer filtering reads).
      const songIdsRes = await db.execute({
        sql: `
          SELECT DISTINCT id FROM (
            SELECT song_id AS id FROM song_artists
            WHERE artist_name = ? COLLATE NOCASE
              OR artist_id = ? COLLATE NOCASE
            UNION
            SELECT id FROM songs
            WHERE artist = ? COLLATE NOCASE
              OR artist LIKE ? COLLATE NOCASE
          );
        `,
        args: [artist.trim(), artist.trim(), artist.trim(), `%${artist.trim()}%`],
      });
      const songIds = songIdsRes.rows.map((r) => String(r.id));

      let affected = 0;
      if (songIds.length > 0) {
        const ph = songIds.map(() => "?").join(",");
        if (usePurge) {
          // Hard delete. FTS5 has an AFTER DELETE trigger, but wipe explicitly
          // too in case the trigger was never created (e.g. older DB).
          await db.execute({
            sql: `DELETE FROM songs_fts WHERE id IN (${ph});`,
            args: songIds,
          });
          const del = await db.execute({
            sql: `DELETE FROM songs WHERE id IN (${ph});`,
            args: songIds,
          });
          affected = del.rowsAffected || 0;
          await db.execute({
            sql: `DELETE FROM song_artists WHERE song_id IN (${ph});`,
            args: songIds,
          });
        } else {
          // Safe: disable songs (is_active = 0)
          const dis = await db.execute({
            sql: `UPDATE songs SET is_active = 0 WHERE id IN (${ph});`,
            args: songIds,
          });
          affected = dis.rowsAffected || 0;
        }
      }

      // Recount artist song_count
      const recount = await db.execute({
        sql: `
          SELECT COUNT(*) as c
          FROM song_artists sa
          JOIN songs s ON s.id = sa.song_id
          WHERE sa.artist_name = ? AND (s.is_active = 1 OR s.is_active IS NULL);
        `,
        args: [artist.trim()],
      });
      const remaining = Number(recount.rows[0]?.c || 0);

      // Recount the stored song_count so the artist card doesn't show a stale number
      await db.execute({
        sql: `
          UPDATE artists
          SET song_count = (
            SELECT COUNT(*)
            FROM song_artists sa
            JOIN songs s ON s.id = sa.song_id
            WHERE sa.artist_id = artists.id
              AND (s.is_active = 1 OR s.is_active IS NULL)
          )
          WHERE name = ?;
        `,
        args: [artist.trim()],
      });

      // If artist has no active songs left, disable the artist too.
      // Match by id OR name (case-insensitive) so it never misses a variant.
      if (remaining === 0) {
        await db.execute({
          sql: "UPDATE artists SET is_active = 0, song_count = 0 WHERE LOWER(name) = LOWER(?) OR LOWER(id) = LOWER(?);",
          args: [artist.trim(), artist.trim()],
        });
      } else {
        await db.execute({
          sql: "UPDATE artists SET is_active = 1 WHERE LOWER(name) = LOWER(?) OR LOWER(id) = LOWER(?);",
          args: [artist.trim(), artist.trim()],
        });
      }

      return NextResponse.json({
        success: true,
        affected,
        remaining,
        artist: artist.trim(),
        mode: usePurge ? "purge" : "disable",
        message: usePurge
          ? `Berhasil menghapus ${affected} lagu "${artist.trim()}" dari katalog.`
          : `Berhasil menonaktifkan ${affected} lagu "${artist.trim()}". Bisa diaktifkan kembali kapan saja.`,
      });
    }

    // 4. RENAME OR MERGE GENRE
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
