// Disaster drill: wipe the volume, restore from songs.json, diff against the
// live database. Run: node scripts/verify-recovery.js
//
// This is the check that says whether a lost Fly volume is a 2-minute problem
// or a 2-day one. It runs the real restore code against a real empty database,
// then compares every column of every song to the live catalogue.
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createClient } = require("@libsql/client");
const { restoreCatalogueIfEmpty } = require("../src/lib/catalogue-restore.js");

const LIVE = path.join(__dirname, "..", "data", "tebak_lagu.db");
const SNAPSHOT = path.join(__dirname, "..", "src", "data", "songs.json");

const SCHEMA = `
  CREATE TABLE songs (
    id TEXT PRIMARY KEY, title TEXT, artist TEXT, year INTEGER, category TEXT,
    difficulty TEXT, popularity INTEGER, deezer_rank INTEGER, bpm INTEGER,
    album TEXT, album_cover TEXT, preview_url TEXT, lyrics_clues TEXT,
    humming_melody TEXT, search_query TEXT, start_second INTEGER,
    youtube_id TEXT, youtube_start_second INTEGER, youtube_status TEXT,
    youtube_checked_at TEXT, is_active INTEGER DEFAULT 1,
    times_played INTEGER DEFAULT 0, times_guessed INTEGER DEFAULT 0,
    times_failed INTEGER DEFAULT 0
  );
`;

// Columns the player actually depends on. youtube_checked_at is a timestamp and
// the three counters are runtime state, so they are expected to differ.
const COMPARED = [
  "title", "artist", "year", "category", "difficulty", "popularity",
  "deezer_rank", "bpm", "album_cover", "preview_url", "lyrics_clues",
  "search_query", "start_second", "youtube_id", "youtube_start_second",
  "youtube_status", "is_active",
];

/**
 * The 19 catalogue stubs have lyrics_clues = NULL and no search_query in the
 * live database. The restore fills both: [] instead of NULL, and a
 * "title artist" search_query. That is a deliberate improvement, not drift —
 * NULL lyrics would break the json_array_length filter, and a null search_query
 * falls through to a LIKE scan. Only accept a difference that is exactly this.
 */
function isExpectedStubDifference(col, live, restored) {
  const l = live == null ? null : String(live);
  const r = restored == null ? null : String(restored);
  if (col === "lyrics_clues") return l === null && r === "[]";
  if (col === "search_query") return l === null && r !== null;
  return false;
}

(async () => {
  const file = path.join(os.tmpdir(), `tl-recovery-${Date.now()}.db`);
  const recovered = createClient({ url: `file:${file}` });
  await recovered.execute(SCHEMA);

  const restored = await restoreCatalogueIfEmpty(recovered, { jsonPath: SNAPSHOT, log: () => {} });
  console.log(`restored ${restored} songs from songs.json into an empty database`);

  const live = createClient({ url: `file:${LIVE}` });
  const liveRows = (await live.execute(`SELECT ${COMPARED.join(", ")} FROM songs ORDER BY id;`)).rows;
  const recRows = (await recovered.execute(`SELECT ${COMPARED.join(", ")} FROM songs ORDER BY id;`)).rows;
  const liveIds = (await live.execute("SELECT id FROM songs ORDER BY id;")).rows.map((r) => r.id);
  const recIds = (await recovered.execute("SELECT id FROM songs ORDER BY id;")).rows.map((r) => r.id);

  // 1. Every song must come back.
  assert.strictEqual(restored, liveRows.length, "restored count must match the live catalogue");
  assert.deepStrictEqual(recIds, liveIds, "restored song ids must match the live catalogue exactly");

  // 2. Every gameplay-relevant column must be identical.
  let differing = 0;
  let stubs = 0;
  for (let i = 0; i < liveRows.length; i++) {
    for (const col of COMPARED) {
      const a = liveRows[i][col] ?? null;
      const b = recRows[i][col] ?? null;
      if (String(a ?? "") !== String(b ?? "")) {
        if (isExpectedStubDifference(col, a, b)) {
          stubs++;
          continue;
        }
        if (differing < 5) {
          console.error(`  ${liveIds[i]} . ${col}: live=${String(a).slice(0, 40)} restored=${String(b).slice(0, 40)}`);
        }
        differing++;
      }
    }
  }
  assert.strictEqual(differing, 0, `${differing} column(s) differ after recovery`);
  console.log(`  expected stub-fill differences: ${stubs}`);

  // 3. The recovered catalogue must be immediately playable.
  const yt = (await recovered.execute("SELECT COUNT(*) c FROM songs WHERE youtube_status='ready';")).rows[0].c;
  const tts = (await recovered.execute(
    "SELECT COUNT(*) c FROM songs WHERE json_array_length(lyrics_clues) >= 4;"
  )).rows[0].c;
  const active = (await recovered.execute("SELECT COUNT(*) c FROM songs WHERE is_active=1;")).rows[0].c;

  console.log(`  ready for Time Slice: ${yt}`);
  console.log(`  ready for Robot TTS : ${tts}`);
  console.log(`  active rows         : ${active}`);
  assert.ok(yt > 2000, `Time Slice needs a large ready pool, got ${yt}`);
  assert.ok(tts > 2000, `Robot TTS needs a large lyric pool, got ${tts}`);

  // 4. The rejected songs must not come back. This was the actual hazard: the
  //    old seed file held 1704 rows that had been deliberately curated out,
  //    465 of them playable.
  const dupes = (await recovered.execute(`
    SELECT COUNT(*) c FROM (SELECT title, artist FROM songs
    GROUP BY title, artist HAVING COUNT(*) > 1);
  `)).rows[0].c;
  assert.strictEqual(dupes, 0, `recovery must not resurrect duplicate songs, got ${dupes}`);

  fs.unlinkSync(file);
  console.log("recovery drill passed: a lost volume restores the full playable catalogue");
})().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
