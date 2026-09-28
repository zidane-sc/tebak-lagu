const { createClient } = require("@libsql/client");
const fs = require("fs");

const ROWS = JSON.parse(fs.readFileSync("/app/data/rows.json", "utf-8"));
const db = createClient({ url: "file:/app/data/tebak_lagu.db" });

(async () => {
  await db.execute("PRAGMA journal_mode = WAL;");
  await db.execute("PRAGMA busy_timeout = 8000;");

  let yt = 0, dz = 0, errs = 0;
  const BATCH = 50;

  for (let i = 0; i < ROWS.length; i += BATCH) {
    const chunk = ROWS.slice(i, i + BATCH);
    const stmts = [];
    for (const r of chunk) {
      stmts.push({
        sql: `UPDATE songs
              SET youtube_id = ?,
                  youtube_status = ?,
                  youtube_start_second = ?,
                  deezer_rank = ?,
                  bpm = ?,
                  difficulty = ?
              WHERE id = ?;`,
        args: [r.y || null, r.s, r.ss, r.d, r.b, r.x, r.id],
      });
      if (r.s === "ready") yt++;
      if (r.d > 0) dz++;
    }
    try {
      await db.batch(stmts, "write");
    } catch (e) {
      errs++;
      for (const s of stmts) {
        try {
          await db.execute(s);
        } catch (_) {}
      }
    }
    if ((i / BATCH) % 10 === 0) process.stdout.write(`\r${i + chunk.length}/${ROWS.length}`);
  }

  // Re-sync the FTS index so it matches songs exactly
  try {
    await db.execute("DELETE FROM songs_fts;");
    await db.execute(`
      INSERT INTO songs_fts(id, title, artist, search_query)
      SELECT id, title, artist, COALESCE(search_query, title || ' ' || artist) FROM songs;
    `);
  } catch (e) {
    console.log("fts resync skipped:", e.message);
  }

  const st = await db.execute(
    "SELECT youtube_status, COUNT(*) c FROM songs GROUP BY youtube_status;"
  );
  const cnt = await db.execute("SELECT COUNT(*) c FROM songs;");
  const fts = await db.execute("SELECT COUNT(*) c FROM songs_fts;");
  console.log("\nstatus:", st.rows);
  console.log("songs:", cnt.rows[0].c, "fts:", fts.rows[0].c);
  console.log(`applied yt=${yt} deezer=${dz} batchErrors=${errs}`);
})();
