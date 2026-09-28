const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");

const db = createClient({ url: `file:${path.resolve(__dirname, "../data/tebak_lagu.db")}` });
const NEW = JSON.parse(fs.readFileSync("/tmp/bernadya_new.json", "utf-8"));

const ARTIST = "Bernadya";
const ARTIST_ID = "bernadya";
const CATEGORY = "Galau Hits";

const YEAR_HINT = {
  "Hug Me Now!": 2025,
  "Lawan Waktu dan Jarak": 2025,
  "Tolong Bilang Ini Mimpi": 2025,
  "Haven't Had the Chance to Know You": 2025,
  "Kita Kubur Sampai Mati": 2025,
  "Berlari": 2025,
  "Kini Mereka Tahu": 2025,
  "Untungnya, Hidup Harus Tetap Berjalan": 2025,
};

(async () => {
  await db.execute("PRAGMA journal_mode = WAL;");
  await db.execute("PRAGMA busy_timeout = 8000;");

  const artRes = await db.execute(
    "SELECT album_cover FROM songs WHERE artist LIKE '%Bernadya%' AND album_cover != '' LIMIT 1;"
  );
  const cover = artRes.rows[0]?.album_cover || "";

  let added = 0;
  for (const s of NEW) {
    const exists = await db.execute({
      sql: "SELECT id FROM songs WHERE id = ?;",
      args: [s.id],
    });
    if (exists.rows.length > 0) {
      console.log(`skip: ${s.title}`);
      continue;
    }

    await db.execute({
      sql: `INSERT INTO songs (
              id, title, artist, year, category, difficulty, popularity,
              album_cover, lyrics_clues, humming_melody, search_query,
              youtube_id, youtube_start_second, youtube_status, youtube_checked_at,
              is_active, times_played, times_guessed, times_failed
            ) VALUES (?,?,?,?,?,'easy',85,?,'[]','[]',?,?,20,'ready',CURRENT_TIMESTAMP,1,0,0,0);`,
      args: [
        s.id, s.title, ARTIST, YEAR_HINT[s.title] || 2025, CATEGORY,
        cover, `${s.title} ${ARTIST}`, s.yt,
      ],
    });

    await db.execute({
      sql: "INSERT OR REPLACE INTO song_artists (song_id, artist_id, artist_name, role) VALUES (?,?,?,'primary');",
      args: [s.id, ARTIST_ID, ARTIST],
    });

    added++;
    console.log(`added: ${s.title} (${s.yt})`);
  }

  await db.execute({
    sql: `UPDATE artists SET song_count = (
            SELECT COUNT(*) FROM song_artists sa JOIN songs s ON s.id = sa.song_id
            WHERE sa.artist_id = artists.id AND (s.is_active = 1 OR s.is_active IS NULL))
          WHERE id = ?;`,
    args: [ARTIST_ID],
  });

  const cnt = await db.execute(
    "SELECT COUNT(*) c FROM songs WHERE artist LIKE '%Bernadya%' AND (is_active=1 OR is_active IS NULL);"
  );
  console.log(`\nadded ${added} | Bernadya total: ${cnt.rows[0].c}`);
})();
