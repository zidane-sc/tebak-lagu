#!/usr/bin/env node
/**
 * Unified Enrichment Worker
 * Enriches: YouTube ID + LRCLIB Lyrics + Deezer (BPM, rank) 
 * Filter: only songs from active artists with >2 songs in catalog
 * 
 * Run: node scripts/enrich-all.js [--limit=100] [--only=lyrics|deezer|youtube|all] [--category="X"] [--dry-run]
 */

const { createClient } = require("@libsql/client");
const https = require("https");
const path = require("path");

const db = createClient({ url: `file:${path.resolve(__dirname, "../data/tebak_lagu.db")}` });

const LIMIT = parseInt(process.argv.find(a => a.startsWith("--limit="))?.split("=")[1] || "100");
const ONLY = process.argv.find(a => a.startsWith("--only="))?.split("=")[1] || "all";
const CATEGORY_ARG = process.argv.find(a => a.startsWith("--category="))?.split("=")[1];
const DRY_RUN = process.argv.includes("--dry-run");
const DELAY_MS = 700;

// Per-source gates
const RUN_YOUTUBE = ONLY === "all" || ONLY === "youtube";
const RUN_LYRICS = ONLY === "all" || ONLY === "lyrics";
const RUN_DEEZER = ONLY === "all" || ONLY === "deezer";

if (DRY_RUN) {
  console.log("🧪 DRY RUN — tidak ada write ke database");
}

// ── YouTube scraper ───────────────────────────────────────────────────────────
const OFFICIAL_KEYWORDS = [
  "official audio", "official video", "official mv", "official music video",
  "vevo", "sony music", "warner music", "universal music",
  "musica studio", "musica studios", "gp records", "nagaswara", "hits records",
];
const claimedYtIds = new Set();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function ytSearch(query) {
  return new Promise((resolve) => {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
        "Accept": "text/html,application/xhtml+xml",
        "Cookie": "CONSENT=YES+1; YSC=x; VISITOR_INFO1_LIVE=x",
      },
    }, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        const data = Buffer.concat(chunks).toString("utf-8");
        try {
          const match = data.match(/var ytInitialData = ({.*?});<\/script>/s);
          const ids = [...new Set((data.match(/"videoId":"([a-zA-Z0-9_-]{11})"/g) || []))];
          if (ids.length === 0) return resolve([]);

          let titled = [];
          if (match) {
            try {
              const parsed = JSON.parse(match[1]);
              const items = parsed.contents?.twoColumnSearchResultsRenderer?.primaryContents
                ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
              for (const item of items) {
                const v = item.videoRenderer;
                if (v?.videoId) {
                  titled.push({
                    videoId: v.videoId,
                    title: v.title?.runs?.[0]?.text || "",
                    channel: v.ownerText?.runs?.[0]?.text || "",
                    duration: v.lengthText?.simpleText || "",
                  });
                  if (titled.length >= 6) break;
                }
              }
            } catch (e) {}
          }
          if (titled.length > 0) return resolve(titled);
          resolve(ids.slice(0, 5).map(m => ({
            videoId: m.replace('"videoId":"', '').replace('"', ''),
            title: "", channel: "", duration: "",
          })));
        } catch (e) { resolve([]); }
      });
    });
    req.on("error", () => resolve([]));
    req.setTimeout(12000, () => { req.destroy(); resolve([]); });
  });
}

function ytScore(c, artist, title) {
  let s = 0;
  const t = (c.title || "").toLowerCase();
  const ch = (c.channel || "").toLowerCase();
  const aTok = artist.toLowerCase().split(/[\s,&]+/).filter(t => t.length > 2);
  const tTok = title.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  for (const tk of aTok) if (ch.includes(tk)) { s += 40; break; }
  for (const tk of tTok) if (t.includes(tk)) { s += 25; break; }
  for (const tk of aTok) if (t.includes(tk)) { s += 15; break; }
  for (const kw of OFFICIAL_KEYWORDS) if (t.includes(kw) || ch.includes(kw)) { s += 20; break; }
  for (const n of ["karaoke", "cover band", "tributa", "sped up", "slowed", "remix"]) {
    if (t.includes(n)) s -= 10;
  }
  return s;
}

async function findYouTubeId(artist, title) {
  const results = await ytSearch(`${artist} ${title}`);
  if (!results.length) return null;
  const scored = results.map(r => ({ ...r, score: ytScore(r, artist, title) })).sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 30) return null;
  if (claimedYtIds.has(best.videoId)) return null;
  claimedYtIds.add(best.videoId);
  return best;
}

// ── LRCLIB lyrics ─────────────────────────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "TebakLagu/4.0" } }, (res) => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve(JSON.parse(d)); } catch (e) { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
  });
}

function cleanArtistName(a) {
  return String(a).replace(/\s*\(.*?\)\s*/g, "").replace(/\s*feat\..*$/i, "").replace(/\s*&.*$/, "").trim();
}
function cleanTitle(t) {
  return String(t).replace(/\s*\(.*?\)\s*/g, "").replace(/\s*\[.*?\]\s*/g, "").replace(/\s*feat\..*$/i, "").trim();
}

async function fetchLyrics(artist, title) {
  const a = encodeURIComponent(cleanArtistName(artist));
  const t = encodeURIComponent(cleanTitle(title));
  let data = await fetchJson(`https://lrclib.net/api/get?artist_name=${a}&track_name=${t}`);
  if (!data) {
    data = await fetchJson(`https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${title}`)}`);
    if (Array.isArray(data) && data.length > 0) {
      // Prefer longest synced/plain lyrics
      data.sort((a, b) => ((b.syncedLyrics || b.plainLyrics || "").length) - ((a.syncedLyrics || a.plainLyrics || "").length));
      data = data[0];
    }
  }
  if (!data) return null;
  const raw = data.plainLyrics || data.syncedLyrics || "";
  if (!raw) return null;

  const lines = raw.split("\n")
    .map(l => l.replace(/\[\d{2}:\d{2}(\.\d+)?\]/g, "").trim())
    .filter(l => l.length > 5 && !l.startsWith("[") && !l.endsWith("]") && !/^\d+$/.test(l));
  if (lines.length < 8) return null;

  // Build 4 stanzas of 2 lines, skipping the first if it leaks the title
  const startLine = lines[0].toLowerCase().includes(cleanTitle(title).toLowerCase()) ? 2 : 0;
  const clues = [];
  for (let i = 0; i < 4; i++) {
    const idx = startLine + i * 2;
    if (idx < lines.length) {
      clues.push(idx + 1 < lines.length ? `${lines[idx]}\n${lines[idx + 1]}` : lines[idx]);
    }
  }
  return clues.length >= 4 ? clues : null;
}

// ── Deezer metadata ───────────────────────────────────────────────────────────
async function fetchDeezer(artist, title) {
  const q = encodeURIComponent(`${artist} ${title}`);
  const data = await fetchJson(`https://api.deezer.com/search?q=${q}&limit=1`);
  if (!data?.data?.[0]) return null;
  const track = data.data[0];
  const detail = await fetchJson(`https://api.deezer.com/track/${track.id}`);
  if (!detail) return null;
  return {
    deezerRank: detail.rank || 0,
    bpm: detail.bpm || 0,
    duration: detail.duration || 0,
  };
}

function difficultyFromRank(rank) {
  if (rank === 0) return null;
  if (rank < 200000) return "easy";
  if (rank < 800000) return "medium";
  return "hard";
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🎵 Unified Enrichment Worker`);
  console.log(`   Limit: ${LIMIT} | Only: ${ONLY} | Category: ${CATEGORY_ARG || "all"} | Dry: ${DRY_RUN}\n`);

  await db.execute("PRAGMA journal_mode = WAL;");

  // Filter: only songs from ACTIVE artists with >2 songs in catalog
  let sql = `
    SELECT s.id, s.title, s.artist, s.category, s.lyrics_clues, s.youtube_status, s.deezer_rank
    FROM songs s
    WHERE (s.is_active = 1 OR s.is_active IS NULL)
      AND s.id IN (
        SELECT sa.song_id
        FROM song_artists sa
        JOIN artists a ON a.id = sa.artist_id
        WHERE a.is_active = 1
          AND (
            SELECT COUNT(*) FROM song_artists sa2
            JOIN songs s2 ON s2.id = sa2.song_id
            WHERE sa2.artist_id = a.id
              AND (s2.is_active = 1 OR s2.is_active IS NULL)
          ) > 2
      )
  `;
  const args = [];
  if (CATEGORY_ARG) {
    sql += " AND s.category = ?";
    args.push(CATEGORY_ARG);
  }
  sql += `
    ORDER BY
      CASE WHEN s.youtube_status IS NULL OR s.youtube_status = 'pending' THEN 0 ELSE 1 END,
      CASE WHEN s.lyrics_clues IS NULL OR s.lyrics_clues = '' OR s.lyrics_clues = '[]' THEN 0 ELSE 1 END,
      CASE WHEN s.deezer_rank IS NULL OR s.deezer_rank = 0 THEN 0 ELSE 1 END,
      s.deezer_rank DESC,
      s.popularity DESC
    LIMIT ?`;
  args.push(LIMIT);

  const res = await db.execute({ sql, args });
  const songs = res.rows;
  console.log(`📋 ${songs.length} lagu dari artis aktif (>2 lagu)\n`);

  let ytOk = 0, lyrOk = 0, dzOk = 0;

  for (let i = 0; i < songs.length; i++) {
    const s = songs[i];
    const p = `[${i + 1}/${songs.length}] ${s.title} — ${s.artist}`;

    // 1. YouTube
    if (RUN_YOUTUBE && (!s.youtube_status || s.youtube_status === "pending")) {
      const yt = await findYouTubeId(String(s.artist), String(s.title));
      if (yt) {
        if (!DRY_RUN) {
          await db.execute({
            sql: `UPDATE songs SET youtube_id = ?, youtube_status = 'ready', youtube_start_second = 20, youtube_checked_at = CURRENT_TIMESTAMP WHERE id = ?;`,
            args: [yt.videoId, s.id],
          });
        }
        ytOk++;
        console.log(`${p}\n   ▶ YT: ${yt.videoId} (${yt.score}) ${yt.channel}`);
      } else if (!DRY_RUN) {
        await db.execute({
          sql: `UPDATE songs SET youtube_status = 'not_found', youtube_checked_at = CURRENT_TIMESTAMP WHERE id = ?;`,
          args: [s.id],
        });
      }
      await sleep(DELAY_MS);
    }

    // 2. Lyrics
    const hasLyrics = s.lyrics_clues && s.lyrics_clues !== "" && s.lyrics_clues !== "[]";
    if (RUN_LYRICS && !hasLyrics) {
      const clues = await fetchLyrics(String(s.artist), String(s.title));
      if (clues) {
        if (!DRY_RUN) {
          await db.execute({
            sql: `UPDATE songs SET lyrics_clues = ? WHERE id = ?;`,
            args: [JSON.stringify(clues), s.id],
          });
        }
        lyrOk++;
        console.log(`   📝 Lirik: ${clues.length} bait ✓`);
      }
      await sleep(300);
    }

    // 3. Deezer
    if (RUN_DEEZER && (!s.deezer_rank || s.deezer_rank === 0)) {
      const dz = await fetchDeezer(String(s.artist), String(s.title));
      if (dz && dz.deezerRank > 0) {
        const newDiff = difficultyFromRank(dz.deezerRank);
        if (!DRY_RUN) {
          if (newDiff) {
            await db.execute({
              sql: `UPDATE songs SET deezer_rank = ?, bpm = ?, difficulty = ? WHERE id = ?;`,
              args: [dz.deezerRank, dz.bpm, newDiff, s.id],
            });
          } else {
            await db.execute({
              sql: `UPDATE songs SET deezer_rank = ?, bpm = ? WHERE id = ?;`,
              args: [dz.deezerRank, dz.bpm, s.id],
            });
          }
        }
        dzOk++;
        console.log(`   🎚️ Deezer: rank ${dz.deezerRank.toLocaleString()} bpm ${dz.bpm}${newDiff ? ` → ${newDiff}` : ""}`);
      }
      await sleep(300);
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`▶ YouTube: ${ytOk}`);
  console.log(`📝 Lyrics:  ${lyrOk}`);
  console.log(`🎚️ Deezer:  ${dzOk}`);
  if (DRY_RUN) console.log(`\n💡 Dry run — no writes`);
}

main().catch(console.error);
