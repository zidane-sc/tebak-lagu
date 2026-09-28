const { createClient } = require("@libsql/client");
const path = require("path");

const db = createClient({ url: `file:${path.resolve(__dirname, "../data/tebak_lagu.db")}` });

// All from Bernadya's own official channel (verified via search).
// Lyric-video variants were avoided where an official music video exists.
const NEW = [
  { title: "Apa Mungkin",                yt: "YIza-jl2Kcs",      dur: "4:08" },
  { title: "Lama-Lama",                  yt: "-HdxWBRV86w",     dur: "3:06" },
  { title: "Ambang Pintu",               yt: "nJz5wKZuLtQ",     dur: "3:01" },
  { title: "Masa Sepi",                  yt: "ucwIbsWVTCE",     dur: "3:31" },
  { title: "Sialnya, Hidup Harus Tetap Berjalan", yt: "m_WgFh6tCxI", dur: "2:59" },
  { title: "Wanita Tak Punya Malu",      yt: "GkXj7cq0JuU",     dur: "3:20" },
  { title: "Rabun Jauh",                 yt: "9ogdEYPggzE",     dur: "2:56" },
  { title: "Laut yang Tenang",           yt: "Q4bAECE339E",     dur: "3:53" },
  { title: "Menyenangkan Mengenalmu",    yt: "SNaYFeFvUjc",     dur: "4:00" },
  { title: "Kita Buat Menyenangkan",     yt: "sdnDInjdWjw",     dur: "4:11" },
  { title: "Sebelum Jadi Panjang",       yt: "5JfqgHGZv08",     dur: "3:43" },
];

const ARTIST = "Bernadya";
const CATEGORY = "Galau Hits";
const ARTIST_ID = "bernadya";

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

(async () => {
  await db.execute("PRAGMA journal_mode = WAL;");
  await db.execute("PRAGMA busy_timeout = 8000;");

  // Cover art from the single we already have, so the new rows aren't blank.
  const artRes = await db.execute(
    "SELECT album_cover FROM songs WHERE artist LIKE '%Bernadya%' AND album_cover != '' LIMIT 1;"
  );
  const cover = artRes.rows[0]?.album_cover || "";
  console.log("cover:", cover || "(none)");

  let added = 0;
  for (const s of NEW) {
    const id = `${ARTIST_ID}-${slug(s.title)}`;
    const exists = await db.execute({ sql: "SELECT id FROM songs WHERE id = ?;", args: [id] });
    if (exists.rows.length > 0) {
      console.log(`skip (exists): ${s.title}`);
      continue;
    }

    await db.execute({
      sql: `
        INSERT INTO songs (
          id, title, artist, year, category, difficulty, popularity,
          album_cover, lyrics_clues, humming_melody, search_query,
          youtube_id, youtube_start_second, youtube_status, youtube_checked_at,
          is_active, times_played, times_guessed, times_failed
        ) VALUES (?, ?, ?, 2025, ?, 'easy', 85, ?, '[]', '[]', ?, ?, 20, 'ready', CURRENT_TIMESTAMP, 1, 0, 0, 0);
      `,
      args: [id, s.title, ARTIST, CATEGORY, cover, `${s.title} ${ARTIST}`, s.yt],
    });

    await db.execute({
      sql: `INSERT OR REPLACE INTO song_artists (song_id, artist_id, artist_name, role) VALUES (?, ?, ?, 'primary');`,
      args: [id, ARTIST_ID, ARTIST],
    });

    added++;
    console.log(`added: ${s.title} (${s.yt})`);
  }

  // Keep artists.song_count honest for the admin card.
  await db.execute({
    sql: `UPDATE artists SET song_count = (
        SELECT COUNT(*) FROM song_artists sa
        JOIN songs s ON s.id = sa.song_id
        WHERE sa.artist_id = artists.id AND (s.is_active = 1 OR s.is_active IS NULL)
      ) WHERE id = ?;`,
    args: [ARTIST_ID],
  });

  const cnt = await db.execute(
    "SELECT COUNT(*) c FROM songs WHERE artist LIKE '%Bernadya%' AND (is_active = 1 OR is_active IS NULL);"
  );
  console.log(`\nadded ${added} | Bernadya total active: ${cnt.rows[0].c}`);
})();
