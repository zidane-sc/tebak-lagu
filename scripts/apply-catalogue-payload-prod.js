// Push the 20 locally-enriched songs (Monita Tahalea batch + Dipha Barus) into
// prod. Idempotent: skips ids that already exist, and any row without lyrics
// is rejected — the same rule /api/admin/songs enforces with 422.
const { createClient } = require("@libsql/client");
const fs = require("fs");

const payload = JSON.parse(fs.readFileSync("/app/data/payload.json", "utf-8"));

(async () => {
  await db_exec();
})();

async function db_exec() {
  const db = createClient({ url: "file:/app/data/tebak_lagu.db" });
  await db.execute("PRAGMA busy_timeout = 10000;");

  let added = 0, skipped = 0, rejected = 0;
  // libsql rejects undefined binds outright; JSON.parse already gave us nulls
  // for absent columns, so normalise anything still undefined.
  const bind = (v) => (v === undefined ? null : v);
  for (const s of payload.songs) {
    const clues = JSON.parse(s.lyricsClues || "[]");
    if (clues.length < 4) {
      console.log(`  reject ${s.id} — only ${clues.length} stanza(s)`);
      rejected++;
      continue;
    }
    const exists = await db.execute({ sql: "SELECT id FROM songs WHERE id = ?;", args: [s.id] });
    if (exists.rows.length > 0) {
      skipped++;
      continue;
    }
    await db.execute({
      sql: `INSERT INTO songs (id, title, artist, year, category, difficulty, popularity,
            deezer_rank, bpm, album, album_cover, preview_url, lyrics_clues, humming_melody,
            search_query, start_second, youtube_id, youtube_start_second, youtube_status,
            youtube_checked_at, is_active, times_played, times_guessed, times_failed)
            VALUES (:id,:title,:artist,:year,:category,:difficulty,:popularity,
            :deezer_rank,:bpm,:album,:album_cover,:preview_url,:lyrics_clues,'[]',
            :search_query,:start_second,:youtube_id,:youtube_start_second,:youtube_status,
            COALESCE(:yt_checked,CURRENT_TIMESTAMP), 1, 0,0,0);`,
      args: {
        id: s.id, title: s.title, artist: s.artist, year: bind(s.year), category: s.category,
        difficulty: s.difficulty, popularity: bind(s.popularity), deezer_rank: bind(s.deezerRank),
        bpm: bind(s.bpm), album: bind(s.album), album_cover: s.albumCover,
        preview_url: s.previewUrl, lyrics_clues: s.lyricsClues, search_query: s.searchQuery,
        start_second: bind(s.startSecond), youtube_id: bind(s.youtubeId),
        youtube_start_second: bind(s.youtubeStartSecond),
        youtube_status: s.youtubeStatus || "pending", yt_checked: bind(s.youtubeId),
      },
    });
    added++;
  }

  // artist master rows + junction, same as apply-payload-prod.js
  for (const sa of payload.songArtists) {
    await db.execute({
      sql: "INSERT OR REPLACE INTO song_artists (song_id, artist_id, artist_name, role) VALUES (?,?,?,'primary');",
      args: [sa.song_id, sa.artist_id, sa.artist_name],
    });
  }
  for (const a of payload.artists) {
    const found = await db.execute({ sql: "SELECT id FROM artists WHERE id = ?;", args: [a.id] });
    if (found.rows.length === 0) {
      await db.execute({
        sql: "INSERT INTO artists (id, name, image, category, song_count, is_active) VALUES (?,?,'',?,?,1);",
        args: [a.id, a.name, a.category, a.song_count],
      });
    } else {
      await db.execute({
        sql: "UPDATE artists SET category = ?, song_count = ? WHERE id = ?;",
        args: [a.category, a.song_count, a.id],
      });
    }
  }
  // Count every junction row, not just is_active=1 songs. song_count is a
  // catalogue statistic; filtering by is_active made artists whose songs are
  // all disabled read as empty, and the prune below then deleted live rows.
  await db.execute(`
    UPDATE artists SET song_count = (
      SELECT COUNT(*) FROM song_artists sa WHERE sa.artist_id = artists.id);
  `);
  // Prune only artists with no junction rows at all, and only after the
  // junction insert above has run — ordering that bug deleted 7 real artists.
  await db.execute(`
    DELETE FROM artists WHERE song_count = 0
      AND NOT EXISTS (SELECT 1 FROM song_artists sa WHERE sa.artist_id = artists.id);
  `);
  await db.execute("DELETE FROM song_artists WHERE NOT EXISTS (SELECT 1 FROM songs s WHERE s.id = song_artists.song_id);");

  // FTS rebuild — the shipped triggers are unreliable across the bulk paths
  await db.execute("DELETE FROM songs_fts;");
  await db.execute(`INSERT INTO songs_fts(id,title,artist,search_query)
    SELECT id,title,artist,COALESCE(NULLIF(search_query,''), title||' '||artist) FROM songs;`);

  await db.execute("PRAGMA wal_checkpoint(TRUNCATE);");

  const cnt = await db.execute("SELECT COUNT(*) c FROM songs;");
  const fts = await db.execute("SELECT COUNT(*) c FROM songs_fts;");
  const st = await db.execute("SELECT youtube_status, COUNT(*) c FROM songs GROUP BY 1;");
  const integ = await db.execute("PRAGMA integrity_check;");
  console.log(`added=${added} skipped=${skipped} rejected=${rejected}`);
  console.log(`songs=${cnt.rows[0].c} fts=${fts.rows[0].c} integrity=${integ.rows[0].integrity_check}`);
  console.log("yt:", JSON.stringify(st.rows));
}
