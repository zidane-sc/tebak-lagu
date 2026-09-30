/**
 * Catalogue restore from songs.json.
 *
 * ponytail: one function, two callers. This was duplicated verbatim in db.ts
 * (TypeScript, API routes) and db-server.js (CommonJS, socket engine), which is
 * how the two drifted — the TypeScript copy was widened to carry the
 * enrichment columns while this one silently kept seeding the old 14 columns.
 * A restore through the socket engine would have dropped every YouTube id.
 *
 * songs.json is a snapshot of the curated catalogue, not a scratch pad: the
 * lyrics, YouTube ids and stream ranks in it took thousands of API calls to
 * produce. It only fires on an empty table, so a restore is a full recovery
 * rather than a blank slate.
 */
const fs = require("fs");
const path = require("path");

/** Columns the restore writes, in the order the INSERT expects. */
const RESTORE_COLUMNS = [
  "id", "title", "artist", "year", "category", "difficulty", "popularity",
  "deezer_rank", "bpm", "album", "album_cover", "preview_url", "lyrics_clues",
  "humming_melody", "search_query", "start_second",
  "youtube_id", "youtube_start_second", "youtube_status", "is_active",
];

function jsonOrString(value) {
  if (value == null) return "[]";
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** Normalise a snapshot row into positional INSERT args. */
function restoreArgs(s) {
  return [
    s.id,
    s.title || "Untitled",
    s.artist || "Unknown",
    s.year || 2020,
    s.category || "Galau Hits",
    s.difficulty || "easy",
    s.popularity || 50,
    s.deezer_rank ?? (s.deezerRank ?? 0),
    s.bpm ?? 0,
    s.album || null,
    s.album_cover ?? (s.albumCover ?? ""),
    s.preview_url ?? (s.previewUrl ?? s.previewResolved ?? ""),
    jsonOrString(s.lyrics_clues ?? s.lyricsClues),
    jsonOrString(s.humming_melody ?? s.hummingMelody),
    s.search_query ?? (s.searchQuery || `${s.title} ${s.artist}`),
    s.start_second ?? 0,
    s.youtube_id || null,
    s.youtube_start_second ?? 20,
    s.youtube_status || (s.youtube_id ? "ready" : "pending"),
    s.is_active ?? 1,
  ];
}

const PLACEHOLDERS = RESTORE_COLUMNS.map(() => "?").join(", ");

/**
 * Restore the catalogue into an empty database. No-op when songs already
 * exist — this never overwrites a live catalogue.
 * Returns the number of rows restored, or 0 when nothing was needed.
 */
async function restoreCatalogueIfEmpty(db, { jsonPath, batchSize = 100, log = console.log } = {}) {
  const countRes = await db.execute("SELECT COUNT(*) as total FROM songs;");
  if (Number(countRes.rows[0]?.total || 0) > 0) return 0;

  const file = jsonPath || path.join(process.cwd(), "src/data/songs.json");
  if (!fs.existsSync(file)) {
    log("> songs.json not found; the catalogue stays empty.");
    return 0;
  }

  log("> Database is empty! Restoring the curated catalogue from songs.json...");
  const songs = JSON.parse(fs.readFileSync(file, "utf-8"));

  const sql = `
    INSERT OR REPLACE INTO songs (
      ${RESTORE_COLUMNS.join(", ")},
      youtube_checked_at, times_played, times_guessed, times_failed
    ) VALUES (${PLACEHOLDERS}, CURRENT_TIMESTAMP, 0, 0, 0);
  `;

  for (let i = 0; i < songs.length; i += batchSize) {
    const stmts = songs
      .slice(i, i + batchSize)
      .map((s) => ({ sql, args: restoreArgs(s) }));
    await db.batch(stmts);
  }

  log(`> Restored ${songs.length} curated songs into the database.`);
  return songs.length;
}

module.exports = { RESTORE_COLUMNS, restoreCatalogueIfEmpty, restoreArgs, jsonOrString };
