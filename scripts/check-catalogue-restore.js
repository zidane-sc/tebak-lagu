// Assert-based self-check for the catalogue restore. Run: npm test
//
// The failure this guards against is silent. If songs.json and the restore
// disagree on a column name, or the snapshot drifts from the database, a
// restore still succeeds — it just produces a worse catalogue, and nothing
// notices until a song is unplayable in production.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { createClient } = require("@libsql/client");
const { restoreCatalogueIfEmpty, RESTORE_COLUMNS, restoreArgs } = require("../src/lib/catalogue-restore.js");

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

async function freshDb() {
  const file = path.join(os.tmpdir(), `tl-restore-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  const c = createClient({ url: `file:${file}` });
  await c.execute(SCHEMA);
  return { client: c, file };
}

(async () => {
  // 1. The snapshot must be a list with the shape the restore expects.
  {
    const songs = JSON.parse(fs.readFileSync(SNAPSHOT, "utf-8"));
    assert.ok(Array.isArray(songs), "songs.json must be an array");
    assert.ok(songs.length > 0, "songs.json must not be empty");
    const first = songs[0];
    for (const col of RESTORE_COLUMNS) {
      assert.ok(col in first, `songs.json rows must carry "${col}"`);
    }
  }

  // 2. A restore into an empty database reproduces the snapshot.
  {
    const { client, file } = await freshDb();
    const n = await restoreCatalogueIfEmpty(client, { jsonPath: SNAPSHOT, log: () => {} });
    const total = (await client.execute("SELECT COUNT(*) c FROM songs;")).rows[0].c;
    assert.strictEqual(total, n, "restored row count must match the snapshot");
    assert.ok(n > 2000, `catalogue should be substantial, got ${n}`);

    const yt = (await client.execute("SELECT COUNT(*) c FROM songs WHERE youtube_id IS NOT NULL;")).rows[0].c;
    assert.ok(yt > 1000, `YouTube ids must survive a restore, got ${yt}`);

    const lyrics = (await client.execute(
      "SELECT COUNT(*) c FROM songs WHERE json_array_length(lyrics_clues) >= 4;"
    )).rows[0].c;
    assert.ok(lyrics > 2000, `four-stanza lyrics must survive a restore, got ${lyrics}`);

    const integ = (await client.execute("PRAGMA integrity_check;")).rows[0].integrity_check;
    assert.strictEqual(integ, "ok", "restored database must pass integrity_check");

    fs.unlinkSync(file);
  }

  // 3. A restore must never touch a populated database. This is the guard against
  //    an admin's catalogue being wiped by a stray init.
  {
    const { client, file } = await freshDb();
    await client.execute("INSERT INTO songs (id, title, artist) VALUES ('keep-me', 'Keep', 'Me');");
    const n = await restoreCatalogueIfEmpty(client, { jsonPath: SNAPSHOT, log: () => {} });
    assert.strictEqual(n, 0, "restore must be a no-op when rows already exist");
    const total = (await client.execute("SELECT COUNT(*) c FROM songs;")).rows[0].c;
    assert.strictEqual(total, 1, "the existing row must be untouched");
    fs.unlinkSync(file);
  }

  // 4. A missing snapshot must not throw; an empty catalogue is better than a
  //    crash loop on boot.
  {
    const { client, file } = await freshDb();
    const n = await restoreCatalogueIfEmpty(client, {
      jsonPath: path.join(os.tmpdir(), "definitely-not-here.json"),
      log: () => {},
    });
    assert.strictEqual(n, 0, "a missing snapshot restores nothing");
    fs.unlinkSync(file);
  }

  // 5. restoreArgs must tolerate both the current and the legacy camelCase shape,
  //    so an older snapshot still restores rather than losing its enrichment.
  {
    const legacy = {
      id: "x", title: "T", artist: "A", deezerRank: 999, albumCover: "cover.jpg",
      previewUrl: "p.mp3", lyricsClues: ["a", "b"], searchQuery: "t a",
    };
    const args = restoreArgs(legacy);
    const at = (col) => args[RESTORE_COLUMNS.indexOf(col)];
    assert.strictEqual(at("deezer_rank"), 999, "legacy deezerRank must map");
    assert.strictEqual(at("album_cover"), "cover.jpg", "legacy albumCover must map");
    assert.strictEqual(at("preview_url"), "p.mp3", "legacy previewUrl must map");
    assert.strictEqual(at("lyrics_clues"), '["a","b"]', "lyrics must serialise");
    assert.strictEqual(at("youtube_start_second"), 20, "a missing start second defaults to 20");
  }

  // 6. Nullish coalescing must not be mixed with || unparenthesised. The first
  //    version of this file did exactly that and would not parse.
  {
    const args = restoreArgs({ id: "y", title: "T", artist: "A", album_cover: "", preview_url: null });
    const at = (col) => args[RESTORE_COLUMNS.indexOf(col)];
    assert.strictEqual(at("album_cover"), "", "an explicit empty cover must stay empty");
    assert.strictEqual(at("preview_url"), "", "a null preview must become an empty string, not the literal null");
  }

    console.log("catalogue-restore: all 6 groups passed");

})().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
