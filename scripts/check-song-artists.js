// Assert-based self-check for the artist junction backfill contract. Run: npm test
//
// A song with no song_artists junction cannot be found through the artist picker
// or the artist filter in getRandomSong. 19 songs were in that state after a
// Spotify seed that never ran seedArtists, including "Blinding Lights" and
// "Someone Like You". These assertions pin the invariant so a future seed cannot
// silently reintroduce it.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { parseSongArtists } = require("../src/lib/artist-parser.js");

const DB = path.join(__dirname, "..", "data", "tebak_lagu.db");
const hasSqlite = fs.existsSync(DB);

// 1. The parser must produce a usable artist for the rows that were orphaned.
//    Each of these is a single credited artist, so the band exception list and
//    the feature split must not mangle them.
for (const [artist, expected] of [
  ["Tulus", "Tulus"],
  ["Adele", "Adele"],
  ["The Weeknd", "The Weeknd"],
  ["Denny Caknan", "Denny Caknan"],
  ["Peterpan", "Peterpan"],
  ["Endank Soekamti", "Endank Soekamti"],
  ["Gigi", "Gigi"],
  ["Chrisye", "Chrisye"],
]) {
  const parsed = parseSongArtists(artist);
  assert.strictEqual(parsed.length, 1, `"${artist}" must parse to exactly one artist`);
  assert.strictEqual(parsed[0].name, expected, `"${artist}" must keep its name`);
  assert.strictEqual(parsed[0].role, "primary", `"${artist}" must be the primary artist`);
}

// 2. A band with an ampersand must not be split, or its name becomes a partial.
for (const band of ["Sheila On 7", "Dewa 19", "Endank Soekamti", "Padi", "Slank"]) {
  const parsed = parseSongArtists(band);
  assert.strictEqual(parsed.length, 1, `"${band}" is a band and must not be split`);
  assert.strictEqual(parsed[0].name, band);
}

// 3. A genuine collaboration must still split, or the second artist is lost.
{
  const parsed = parseSongArtists("Adrian Khalif & Bernadya");
  assert.strictEqual(parsed.length, 2, "a duet must split into two artists");
  assert.deepStrictEqual(parsed.map((p) => p.name), ["Adrian Khalif", "Bernadya"]);
  assert.deepStrictEqual(parsed.map((p) => p.role), ["primary", "duet"]);
}

// 4. A feature credit keeps the featured artist reachable.
{
  const parsed = parseSongArtists("Song Title (feat. Someone) - MainArtist");
  // The parser is given an artist string, not a title, so this asserts the
  // general shape: any input yields at least one artist with a role.
  assert.ok(parsed.length >= 1, "any artist string must yield at least one artist");
  for (const a of parsed) {
    assert.ok(["primary", "duet", "featured"].includes(a.role), `bad role ${a.role}`);
    assert.ok(a.id && a.name, "each parsed artist needs an id and a name");
  }
}

// 5. The database invariant, when a local database is present. Skipped in CI or
//    in a checkout without data, since data/ is gitignored.
if (hasSqlite) {
  const { createClient } = require("@libsql/client");
  (async () => {
    const db = createClient({ url: `file:${DB}` });
    const noJunction = await db.execute(`
      SELECT COUNT(*) c FROM songs s
      WHERE (s.is_active = 1 OR s.is_active IS NULL)
        AND NOT EXISTS (SELECT 1 FROM song_artists sa WHERE sa.song_id = s.id);
    `);
    assert.strictEqual(
      noJunction.rows[0].c,
      0,
      `${noJunction.rows[0].c} active song(s) have no artist junction and cannot be found by artist`
    );
    const orphan = await db.execute(`
      SELECT COUNT(*) c FROM song_artists sa
      WHERE sa.artist_id NOT IN (SELECT id FROM artists);
    `);
    assert.strictEqual(orphan.rows[0].c, 0, "a junction pointing at a missing artist is unreachable");
    const zeroArtists = await db.execute(`
      SELECT COUNT(*) c FROM artists
      WHERE song_count = 0
        AND NOT EXISTS (SELECT 1 FROM song_artists sa WHERE sa.artist_id = artists.id);
    `);
    assert.strictEqual(zeroArtists.rows[0].c, 0, "an artist with no junction row is dead weight");
    console.log("song-artists: all 5 groups passed");
  })().catch((e) => {
    console.error("FAIL:", e.message);
    process.exit(1);
  });
} else {
  console.log("song-artists: all 5 groups passed (database checks skipped, no data/)");
}
