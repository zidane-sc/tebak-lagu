// Read-only safety snapshot of prod before the catalogue push. Prints counts
// and a stable hash of the song catalogue so a bad push can be diffed.
const { createClient } = require("@libsql/client");
const fs = require("fs");
const db = createClient({ url: "file:/app/data/tebak_lagu.db" });
(async () => {
  const cnt = await db.execute("SELECT COUNT(*) c FROM songs;");
  const fts = await db.execute("SELECT COUNT(*) c FROM songs_fts;");
  const yts = await db.execute("SELECT youtube_status, COUNT(*) c FROM songs GROUP BY 1;");
  const lyr = await db.execute("SELECT COUNT(*) c FROM songs WHERE json_array_length(lyrics_clues) >= 4;");
  const integ = await db.execute("PRAGMA integrity_check;");
  const ids = await db.execute("SELECT id FROM songs ORDER BY id;");
  const hash = require("crypto")
    .createHash("sha256")
    .update(ids.rows.map((r) => r.id).join("\n"))
    .digest("hex")
    .slice(0, 16);
  const out = {
    at: new Date().toISOString(),
    songs: cnt.rows[0].c,
    fts: fts.rows[0].c,
    lyrics4: lyr.rows[0].c,
    catalogHash: hash,
    integrity: integ.rows[0].integrity_check,
    youtube: Object.fromEntries(yts.rows.map((r) => [r.youtube_status, r.c])),
  };
  fs.writeFileSync("/app/data/pre-push-snapshot.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out));
})();
