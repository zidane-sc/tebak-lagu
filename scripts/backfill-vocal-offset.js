#!/usr/bin/env node
/**
 * Set youtube_start_second from the first vocal offset in the LRCLIB synced
 * lyrics, so a Time Slice clue starts on the singing rather than a fixed 20s.
 *
 * Why: the fixed default skips the first 20 seconds of every track. For a song
 * that opens on vocals that is most of the recognisable part, and for a song
 * with a long intro it is still a few seconds short. A 40-song probe found the
 * first vocal between 0s and 56s, median 11s.
 *
 * Assumption worth stating: the LRCLIB timestamp is an offset into the studio
 * master, and both the YouTube upload and the Apple 30s preview are cuts of
 * that master, so the offset carries over. It is not verified by listening, and
 * a live recording would be off — those are rejected as non-original elsewhere
 * but a live *upload* of a studio track would slip through.
 *
 * Run: node scripts/backfill-vocal-offset.js [--limit=N] [--dry-run] [--workers=N]
 */
const { createClient } = require("@libsql/client");
const https = require("https");
const path = require("path");

const db = createClient({ url: `file:${path.resolve(__dirname, "../data/tebak_lagu.db")}` });

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : fallback;
};
const LIMIT = arg("limit", 3000);
const WORKERS = arg("workers", 6);
const DRY_RUN = process.argv.includes("--dry-run");

/** Clamp: never start past the point where a clue tier would have no audio. */
const MIN_OFFSET = 0;
const MAX_OFFSET = 45;

function firstVocalOffset(artist, title) {
  return new Promise((resolve) => {
    const url =
      `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}` +
      `&track_name=${encodeURIComponent(title)}`;
    const req = https.get(url, { headers: { "User-Agent": "TebakLagu/3.0" } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        if (res.statusCode !== 200) return resolve(null);
        try {
          const j = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (j.instrumental) return resolve(null);
          const m = (j.syncedLyrics || "").match(/\[(\d+):(\d+(?:\.\d+)?)\]/);
          if (!m) return resolve(null);
          const seconds = Number(m[1]) * 60 + Number(m[2]);
          resolve(Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, Math.floor(seconds))));
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(20000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

(async () => {
  await db.execute("PRAGMA busy_timeout = 10000;");

  const res = await db.execute(`
    SELECT id, title, artist FROM songs
    WHERE is_active = 1
      AND youtube_status = 'ready'
      AND youtube_id IS NOT NULL
      AND youtube_id != ''
      AND youtube_start_second = 20
    ORDER BY deezer_rank DESC
    LIMIT ?;
  `, [LIMIT]);

  const songs = res.rows;
  console.log(`\n🎤 Vocal offset backfill`);
  console.log(`   ${songs.length} songs | workers ${WORKERS} | dry-run ${DRY_RUN}\n`);

  let updated = 0, unchanged = 0, noLyrics = 0, done = 0;
  let queue = songs.slice();

  async function worker() {
    while (queue.length) {
      const song = queue.shift();
      const offset = await firstVocalOffset(song.artist, song.title);
      done++;
      if (offset === null) {
        noLyrics++;
      } else if (offset === 20) {
        unchanged++;
      } else {
        if (!DRY_RUN) {
          await db.execute({
            sql: "UPDATE songs SET youtube_start_second = ? WHERE id = ?;",
            args: [offset, song.id],
          });
        }
        updated++;
      }
      if (done % 25 === 0 || done === songs.length) {
        const pct = ((done / songs.length) * 100).toFixed(0);
        console.log(
          `  [${done}/${songs.length}] ${pct}%  set=${updated} already20=${unchanged} no-synced=${noLyrics}`
        );
      }
    }
  }

  await Promise.all(Array.from({ length: WORKERS }, worker));

  const after = await db.execute(
    "SELECT COUNT(*) c FROM songs WHERE youtube_start_second != 20;"
  );
  console.log(`\n=== Done ===`);
  console.log(`set=${updated}  already 20=${unchanged}  no synced lyrics=${noLyrics}`);
  console.log(`rows with a non-default offset: ${after.rows[0].c}`);
  if (DRY_RUN) console.log("dry-run: no writes.");
})();
