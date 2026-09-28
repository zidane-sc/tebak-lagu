const { createClient } = require("@libsql/client");
const fs = require("fs");

const payload = JSON.parse(fs.readFileSync("/app/data/rows.json", "utf-8"));
const db = createClient({ url: "file:/app/data/tebak_lagu.db" });

(async () => {
  await db.execute("PRAGMA journal_mode = WAL;");
  await db.execute("PRAGMA busy_timeout = 8000;");

  let added = 0, updated = 0, lyrics = 0;

  // 1. Insert brand-new songs (id not present yet)
  for (const s of payload.newSongs) {
    const exists = await db.execute({ sql: "SELECT id FROM songs WHERE id = ?;", args: [s.id] });
    if (exists.rows.length > 0) { updated++; continue; }
    await db.execute({
      sql: `INSERT INTO songs (id, title, artist, year, category, difficulty, popularity,
            album_cover, lyrics_clues, humming_melody, search_query,
            youtube_id, youtube_start_second, youtube_status, youtube_checked_at,
            is_active, times_played, times_guessed, times_failed)
            VALUES (?,?,?,?,?,'easy',?,?,?, '[]', ?, ?, 20, ?, CURRENT_TIMESTAMP, 1,0,0,0);`,
      args: [s.id, s.title, s.artist, s.year, s.category, s.popularity, s.albumCover,
             s.lyricsClues, s.searchQuery, s.youtubeId, s.youtubeStatus],
    });
    added++;
  }

  // 2. Update enrichment on existing songs
  const BATCH = 50;
  for (let i = 0; i < payload.rows.length; i += BATCH) {
    const chunk = payload.rows.slice(i, i + BATCH);
    const stmts = chunk.map((r) => ({
      sql: `UPDATE songs SET youtube_id=?, youtube_status=?, youtube_start_second=?,
            deezer_rank=?, bpm=?, difficulty=? WHERE id=?;`,
      args: [r.y || null, r.s, r.ss, r.d, r.b, r.x, r.id],
    }));
    await db.batch(stmts, "write");
  }

  // 3. Write lyrics separately (they contain newlines)
  for (const l of payload.lyrics || []) {
    if (!l.lyrics) continue;
    await db.execute({ sql: "UPDATE songs SET lyrics_clues = ? WHERE id = ?;", args: [l.lyrics, l.id] });
    lyrics++;
  }

  // 4. Junction rows for new songs
  for (const sa of payload.songArtists || []) {
    await db.execute({
      sql: "INSERT OR REPLACE INTO song_artists (song_id, artist_id, artist_name, role) VALUES (?,?,?,'primary');",
      args: [sa.song_id, sa.artist_id, sa.artist_name],
    });
  }

  // 5. Upsert artists (new masters + song_count refresh)
  for (const a of payload.artists || []) {
    const found = await db.execute({ sql: "SELECT id FROM artists WHERE id = ?;", args: [a.id] });
    if (found.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO artists (id, name, image, category, song_count, is_active)
              VALUES (?, ?, '', ?, ?, 1);`,
        args: [a.id, a.name, a.category, a.song_count],
      });
    } else {
      await db.execute({
        sql: "UPDATE artists SET category = ?, song_count = ? WHERE id = ?;",
        args: [a.category, a.song_count, a.id],
      });
    }
  }

  // 6. Keep artists.song_count accurate
  await db.execute(`
    UPDATE artists SET song_count = (
      SELECT COUNT(*) FROM song_artists sa JOIN songs s ON s.id = sa.song_id
      WHERE sa.artist_id = artists.id AND (s.is_active = 1 OR s.is_active IS NULL));
  `);

  // 7. Re-sync FTS so search reflects the new songs
  try {
    await db.execute("DELETE FROM songs_fts;");
    await db.execute(`INSERT INTO songs_fts(id,title,artist,search_query)
      SELECT id,title,artist,COALESCE(search_query, title||' '||artist) FROM songs;`);
  } catch (e) { console.log("fts:", e.message); }

  const st = await db.execute("SELECT youtube_status, COUNT(*) c FROM songs GROUP BY youtube_status;");
  const cnt = await db.execute("SELECT COUNT(*) c FROM songs;");
  const fts = await db.execute("SELECT COUNT(*) c FROM songs_fts;");
  console.log("\nstatus:", st.rows);
  console.log(`songs=${cnt.rows[0].c} fts=${fts.rows[0].c}`);
  console.log(`new=${added} existing=${updated} lyrics=${lyrics}`);
})();
