const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");

const db = createClient({ url: `file:${path.resolve(__dirname, "../data/tebak_lagu.db")}` });
const SONGS = JSON.parse(fs.readFileSync("/tmp/rap_new.json", "utf-8"));

const PLAYLIST = "Rap";
const ARTISTS = {
  k3bi:   { name: "K3BI",           category: PLAYLIST },
  muria:  { name: "Muria",          category: PLAYLIST },
  tuan13: { name: "Tuan Tigabelas", category: PLAYLIST },
};

(async () => {
  await db.execute("PRAGMA journal_mode = WAL;");
  await db.execute("PRAGMA busy_timeout = 8000;");

  // Create the playlist entry in app_settings-driven category list by ensuring
  // the three artists exist with the right category.
  let added = 0, skipped = 0;
  const touchedArtists = new Set();

  for (const s of SONGS) {
    const a = ARTISTS[s.artist_id];
    if (!a) continue;
    touchedArtists.add(s.artist_id);

    const exists = await db.execute({
      sql: "SELECT id FROM songs WHERE id = ?;",
      args: [s.id],
    });
    if (exists.rows.length > 0) { skipped++; continue; }

    await db.execute({
      sql: `INSERT INTO songs (
              id, title, artist, year, category, difficulty, popularity,
              album_cover, lyrics_clues, humming_melody, search_query,
              youtube_id, youtube_start_second, youtube_status, youtube_checked_at,
              is_active, times_played, times_guessed, times_failed
            ) VALUES (?,?,?,?,?,'medium',60,'', '[]','[]',?,?,20,'ready',CURRENT_TIMESTAMP,1,0,0,0);`,
      args: [
        s.id, s.title, a.name, s.year, PLAYLIST,
        `${s.title} ${a.name}`, s.yt,
      ],
    });

    await db.execute({
      sql: "INSERT OR REPLACE INTO song_artists (song_id, artist_id, artist_name, role) VALUES (?,?,?,'primary');",
      args: [s.id, s.artist_id, a.name],
    });

    added++;
  }

  // Upsert artist master rows with the Rap playlist as their category
  for (const [aid, a] of Object.entries(ARTISTS)) {
    const found = await db.execute({
      sql: "SELECT id FROM artists WHERE id = ?;",
      args: [aid],
    });
    if (found.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO artists (id, name, image, category, song_count, is_active)
              VALUES (?, ?, '', ?, 0, 1);`,
        args: [aid, a.name, PLAYLIST],
      });
      console.log(`artist created: ${a.name}`);
    } else {
      await db.execute({
        sql: "UPDATE artists SET category = ? WHERE id = ?;",
        args: [PLAYLIST, aid],
      });
    }
  }

  // Refresh song_count per artist
  for (const aid of Object.keys(ARTISTS)) {
    await db.execute({
      sql: `UPDATE artists SET song_count = (
              SELECT COUNT(*) FROM song_artists sa JOIN songs s ON s.id = sa.song_id
              WHERE sa.artist_id = artists.id AND (s.is_active = 1 OR s.is_active IS NULL))
            WHERE id = ?;`,
      args: [aid],
    });
  }

  const counts = await db.execute(
    "SELECT category, COUNT(*) c FROM songs WHERE category = ? GROUP BY category;",
    { args: [PLAYLIST] }
  );

  console.log(`\nadded=${added} skipped=${skipped}`);
  console.log("playlist totals:", counts.rows);

  const perArtist = await db.execute(
    `SELECT a.name, a.song_count FROM artists a WHERE a.id IN ('k3bi','muria','tuan13');`
  );
  console.log("artists:", perArtist.rows);
})();
