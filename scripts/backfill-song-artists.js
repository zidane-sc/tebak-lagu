#!/usr/bin/env node
/**
 * Fill in the song_artists junction for songs that have none.
 *
 * A song with no junction row cannot be found through the artist picker or the
 * artist filter in getRandomSong, so 19 tracks were unreachable that way —
 * "Blinding Lights" and "Someone Like You" among them. The rows were added by a
 * Spotify seed that never ran seedArtists, and a full re-seed is risky because
 * it rewrites every junction rather than only the missing ones.
 *
 * This uses the same parser as the full seed, so the artist ids and roles match.
 *
 * Run: node scripts/backfill-song-artists.js [--dry-run]
 */
const { createClient } = require("@libsql/client");
const path = require("path");
const { parseSongArtists } = require("../src/lib/artist-parser.js");

const db = createClient({
  url: `file:${path.resolve(__dirname, "../data/tebak_lagu.db")}`,
});
const DRY_RUN = process.argv.includes("--dry-run");

(async () => {
  await db.execute("PRAGMA busy_timeout = 10000;");

  const missing = await db.execute(`
    SELECT s.id, s.artist FROM songs s
    WHERE NOT EXISTS (SELECT 1 FROM song_artists sa WHERE sa.song_id = s.id)
    ORDER BY s.id;
  `);
  console.log(`\n🎤 Junction backfill`);
  console.log(`   ${missing.rows.length} songs without a junction | dry-run ${DRY_RUN}\n`);

  let added = 0;
  let artistsCreated = 0;
  const seenArtistIds = new Set();

  for (const song of missing.rows) {
    const parsed = parseSongArtists(song.artist);
    if (parsed.length === 0) {
      console.log(`   skip ${song.id} — "${song.artist}" parsed to nothing`);
      continue;
    }
    console.log(`   ${song.id} — "${song.artist}" -> ${parsed.map((p) => p.name).join(" + ")}`);

    if (DRY_RUN) {
      added += parsed.length;
      continue;
    }

    for (const a of parsed) {
      if (!seenArtistIds.has(a.id)) {
        seenArtistIds.add(a.id);
        const exists = await db.execute({
          sql: "SELECT id FROM artists WHERE id = ?;",
          args: [a.id],
        });
        if (exists.rows.length === 0) {
          await db.execute({
            sql: `INSERT OR IGNORE INTO artists (id, name, image, category, song_count, is_active)
                  VALUES (?, ?, '', 'Western Hits', 0, 1);`,
            args: [a.id, a.name],
          });
          artistsCreated++;
        }
      }
      await db.execute({
        sql: `INSERT OR REPLACE INTO song_artists (song_id, artist_id, artist_name, role)
              VALUES (?, ?, ?, ?);`,
        args: [song.id, a.id, a.name, a.role],
      });
    }
    added += parsed.length;
  }

  if (!DRY_RUN) {
    // Recompute song_count across every artist. Count junction rows rather than
    // is_active songs: filtering by is_active made an artist whose songs are all
    // disabled look empty, which is how a previous sweep deleted live artists.
    await db.execute(`
      UPDATE artists SET song_count = (
        SELECT COUNT(*) FROM song_artists sa WHERE sa.artist_id = artists.id);
    `);
    await db.execute("PRAGMA wal_checkpoint(TRUNCATE);");
  }

  const after = await db.execute(`
    SELECT COUNT(*) c FROM songs s
    WHERE NOT EXISTS (SELECT 1 FROM song_artists sa WHERE sa.song_id = s.id);
  `);
  const junction = await db.execute("SELECT COUNT(*) c FROM song_artists;");
  const artistCount = await db.execute("SELECT COUNT(*) c FROM artists;");
  const orphans = await db.execute(`
    SELECT COUNT(*) c FROM song_artists sa
    WHERE sa.artist_id NOT IN (SELECT id FROM artists);
  `);
  const noSong = await db.execute(`
    SELECT COUNT(*) c FROM artists
    WHERE song_count = 0
      AND NOT EXISTS (SELECT 1 FROM song_artists sa WHERE sa.artist_id = artists.id);
  `);

  console.log(`\n=== Done ===`);
  console.log(`junction rows added: ${added}  new artist rows: ${artistsCreated}`);
  console.log(`songs still without a junction: ${after.rows[0].c}`);
  console.log(`song_artists=${junction.rows[0].c}  artists=${artistCount.rows[0].c}`);
  console.log(`orphan junctions=${orphans.rows[0].c}  artists with no junction=${noSong.rows[0].c}`);
})();
