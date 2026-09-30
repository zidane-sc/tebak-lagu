#!/usr/bin/env node
/**
 * Second pass of the vocal-offset backfill: the first pass matched only the
 * exact stored title, so anything LRCLIB files differently was skipped —
 * "Poker Face (LLG vs. GLG Radio Edit)" 404s, and a handful of tracks have
 * plain lyrics but no synced file under that exact name.
 *
 * Three fallbacks, cheapest first:
 *   1. exact title+artist
 *   2. title with parenthetical and bracketed suffixes stripped
 *   3. /api/search on the stripped title, taking the best duration match
 *
 * Only writes when a real synced-lyrics offset is found, so a wrong match
 * cannot move the offset: the 20s default stays wherever nothing is confirmed.
 *
 * Run: node scripts/backfill-vocal-offset-retry.js [--limit=N] [--dry-run]
 */
const { createClient } = require("@libsql/client");
const https = require("https");
const path = require("path");

const db = createClient({ url: `file:${path.resolve(__dirname, "../data/tebak_lagu.db")}` });

const arg = (n, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? Number(hit.split("=")[1]) : d;
};
const LIMIT = arg("limit", 3000);
const WORKERS = arg("workers", 4);
const DRY_RUN = process.argv.includes("--dry-run");

const MIN_OFFSET = 0;
const MAX_OFFSET = 45;

/**
 * LRCLIB throttles bursts: a run of 25 requests returns 403 partway through,
 * which is why the first pass only resolved 245 of 2811. Retry with backoff and
 * a small per-worker delay so a throttled response is not mistaken for "this
 * track has no synced lyrics".
 */
const THROTTLE_CODES = new Set([403, 429, 503]);

function getOnce(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { "User-Agent": "TebakLagu/3.0" } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        if (res.statusCode !== 200) return resolve({ status: res.statusCode });
        try {
          resolve({ status: 200, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
        } catch {
          resolve({ status: 0 });
        }
      });
    });
    req.on("error", () => resolve({ status: 0 }));
    req.setTimeout(20000, () => {
      req.destroy();
      resolve({ status: 0 });
    });
  });
}

async function getJson(url, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    const r = await getOnce(url);
    if (r.status === 200) return r.body;
    if (!THROTTLE_CODES.has(r.status)) return null;
    // 2s, 5s, 12s — LRCLIB recovers within a few seconds
    await new Promise((res) => setTimeout(res, [2000, 5000, 12000][i] || 12000));
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const offsetFrom = (j) => {
  if (!j || j.instrumental) return null;
  const m = (j.syncedLyrics || "").match(/\[(\d+):(\d+(?:\.\d+)?)\]/);
  if (!m) return null;
  const s = Number(m[1]) * 60 + Number(m[2]);
  return Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, Math.floor(s)));
};

/** "Poker Face (LLG vs. GLG Radio Edit)" -> "Poker Face" */
function stripTitle(title) {
  return String(title || "")
    .replace(/\s*[\(\[][^\)\]]*[\)\]]\s*$/g, "")
    .replace(/\s*-\s*(radio|mono|stereo)\s+edit.*$/i, "")
    .trim();
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

async function findOffset(artist, title, duration) {
  // 1. exact
  let hit = offsetFrom(
    await getJson(
      `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`
    )
  );
  if (hit !== null) return { offset: hit, via: "exact" };

  const bare = stripTitle(title);
  if (bare && bare !== title) {
    // 2. stripped title
    hit = offsetFrom(
      await getJson(
        `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(bare)}`
      )
    );
    if (hit !== null) return { offset: hit, via: "stripped" };
  }

  // 3. search, preferring a track whose name and artist match
  const found = await getJson(
    `https://lrclib.net/api/search?track_name=${encodeURIComponent(bare || title)}`
  );
  if (Array.isArray(found) && found.length) {
    const want = norm(bare || title);
    const wantArtist = norm(artist);
    const scored = found
      .map((c) => {
        let s = 0;
        if (norm(c.trackName) === want) s += 10;
        else if (norm(c.trackName).startsWith(want)) s += 4;
        if (wantArtist && norm(c.artistName).includes(wantArtist)) s += 5;
        if (duration && c.duration && Math.abs(c.duration - duration) < 6) s += 3;
        return { c, s };
      })
      .sort((a, b) => b.s - a.s);
    if (scored[0] && scored[0].s >= 9) {
      const o = offsetFrom(scored[0].c);
      if (o !== null) return { offset: o, via: "search" };
    }
  }
  return { offset: null, via: "none" };
}

(async () => {
  await db.execute("PRAGMA busy_timeout = 10000;");

  const res = await db.execute(`
    SELECT s.id, s.title, s.artist, s.youtube_id
    FROM songs s
    WHERE s.is_active = 1 AND s.youtube_status = 'ready'
      AND s.youtube_id IS NOT NULL AND s.youtube_id != ''
      AND s.youtube_start_second = 20
    ORDER BY s.deezer_rank DESC
    LIMIT ?;
  `, [LIMIT]);

  const songs = res.rows;
  console.log(`\n🎤 Vocal offset retry (stripped title + search fallback)`);
  console.log(`   ${songs.length} songs at the default | workers ${WORKERS} | dry-run ${DRY_RUN}\n`);

  let set = 0, noLyrics = 0, done = 0;
  const via = { exact: 0, stripped: 0, search: 0 };
  let queue = songs.slice();

  async function worker(w) {
    while (queue.length) {
      const song = queue.shift();
      const { offset, via: how } = await findOffset(song.artist, song.title, null);
      done++;
      if (w === 0) await sleep(40); // spread the burst so LRCLIB does not throttle
      if (offset === null) {
        noLyrics++;
      } else {
        via[how] = (via[how] || 0) + 1;
        if (!DRY_RUN) {
          await db.execute({
            sql: "UPDATE songs SET youtube_start_second = ? WHERE id = ?;",
            args: [offset, song.id],
          });
        }
        set++;
      }
      if (done % 100 === 0 || done === songs.length) {
        console.log(
          `  [${done}/${songs.length}] set=${set} (exact ${via.exact}, stripped ${via.stripped}, search ${via.search})  no synced=${noLyrics}`
        );
      }
    }
  }

  await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i)));

  const after = await db.execute(
    "SELECT COUNT(*) c FROM songs WHERE youtube_start_second != 20;"
  );
  console.log(`\n=== Done ===`);
  console.log(`set=${set}  via exact=${via.exact} stripped=${via.stripped} search=${via.search}  no synced lyrics=${noLyrics}`);
  console.log(`rows with a non-default offset: ${after.rows[0].c}`);
  if (DRY_RUN) console.log("dry-run: no writes.");
})();
