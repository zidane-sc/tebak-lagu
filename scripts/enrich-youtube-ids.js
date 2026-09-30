#!/usr/bin/env node
/**
 * scripts/enrich-youtube-ids.js
 * Fetch YouTube IDs for songs with youtube_status = 'pending'.
 * Resumable — saves checkpoint per batch.
 * Run: node scripts/enrich-youtube-ids.js [--limit=50] [--dry-run]
 */

const { createClient } = require("@libsql/client");
const { isAcceptable, isNonOriginal, titleOverlap, scoreResult } = require("../src/lib/youtube-matcher.js");
const https = require("https");
const path = require("path");

const db = createClient({ url: `file:${path.resolve(__dirname, "../data/tebak_lagu.db")}` });

const LIMIT = parseInt(process.argv.find(a => a.startsWith("--limit="))?.split("=")[1] || "50");
const CATEGORY_ARG = process.argv.find(a => a.startsWith("--category="))?.split("=")[1];
const DRY_RUN = process.argv.includes("--dry-run");
const DELAY_MS = 800; // be polite to YouTube

// Tracks video IDs already assigned in this run so two songs never share one video
const claimedIds = new Set();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchYouTubeSearch(query) {
  return new Promise((resolve) => {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
        "Accept": "text/html,application/xhtml+xml",
        "Cookie": "CONSENT=YES+1; YSC=x; VISITOR_INFO1_LIVE=x",
      }
    }, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        const data = Buffer.concat(chunks).toString("utf-8");
        try {
          // Regex videoId from HTML — most reliable
          const idMatches = [...new Set((data.match(/"videoId":"([a-zA-Z0-9_-]{11})"/g) || []))];
          if (idMatches.length === 0) return resolve([]);

          // Try to get titles too via ytInitialData
          let titles = [];
          try {
            const match = data.match(/var ytInitialData = ({.*?});<\/script>/s);
            if (match) {
              const parsed = JSON.parse(match[1]);
              const contents =
                parsed.contents?.twoColumnSearchResultsRenderer?.primaryContents
                  ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
              for (const item of contents) {
                const v = item.videoRenderer;
                if (v?.videoId) {
                  titles.push({
                    videoId: v.videoId,
                    title: v.title?.runs?.[0]?.text || "",
                    channel: v.ownerText?.runs?.[0]?.text || "",
                    duration: v.lengthText?.simpleText || "",
                    source: "ytInitialData",
                  });
                  if (titles.length >= 5) break;
                }
              }
            }
          } catch (e) {}

          if (titles.length > 0) return resolve(titles);

          // Fallback: use raw regex IDs
          const results = idMatches.slice(0, 5).map(m => ({
            videoId: m.replace('"videoId":"', "").replace('"', ""),
            title: "",
            channel: "",
            source: "regex",
          }));
          resolve(results);
        } catch (e) {
          resolve([]);
        }
      });
    });
    req.on("error", () => resolve([]));
    req.setTimeout(12000, () => { req.destroy(); resolve([]); });
  });
}

async function findYouTubeId(artist, title) {
  const query = `${artist} ${title}`;
  const results = await fetchYouTubeSearch(query);
  if (!results.length) return null;

  // Score and pick best
  const scored = results.map(r => ({ ...r, score: scoreResult(r, artist, title) }));
  scored.sort((a, b) => b.score - a.score);

  // Judge every candidate, not just the top scorer. The highest-scoring result
  // is often a lyric-only upload or a live cut, and rejecting on that alone
  // threw away songs where a perfectly good official video sat in second place.
  // Rejecting a wrong video is worse than no video, since a wrong ID makes the
  // game play the wrong song.
  const best = scored.find((c) => isAcceptable(c, artist, title));
  if (!best) return null;

  // Reject an ID already claimed by another song in this run
  if (claimedIds.has(best.videoId)) return null;
  claimedIds.add(best.videoId);

  return best;
}

async function main() {
  console.log(`\n🎵 YouTube ID Enrichment Worker`);
  console.log(`   Limit: ${LIMIT} | Dry-run: ${DRY_RUN}\n`);

  await db.execute("PRAGMA journal_mode = WAL;");

  // Fetch pending songs (optionally filtered by category)
  let sql = `
    SELECT id, title, artist, category
    FROM songs
    WHERE is_active = 1
      AND (youtube_status IS NULL OR youtube_status = 'pending')
  `;
  const args = [];
  if (CATEGORY_ARG) {
    sql += " AND category = ?";
    args.push(CATEGORY_ARG);
    console.log(`🎯 Category filter: "${CATEGORY_ARG}"`);
  }
  sql += " ORDER BY deezer_rank DESC, popularity DESC LIMIT ?";
  args.push(LIMIT);

  const res = await db.execute({ sql, args });

  const songs = res.rows;
  console.log(`📋 Found ${songs.length} songs to enrich\n`);

  let found = 0, notFound = 0, errors = 0;

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    const progress = `[${i + 1}/${songs.length}]`;

    try {
      const result = await findYouTubeId(String(song.artist), String(song.title));

      if (result?.videoId) {
        console.log(`${progress} ✅ ${song.title} — ${song.artist}`);
        console.log(`         → ${result.videoId} | "${result.title}" (${result.channel}) score:${result.score}`);

        if (!DRY_RUN) {
          await db.execute({
            sql: `
              UPDATE songs
              SET youtube_id = ?,
                  youtube_status = 'ready',
                  youtube_start_second = 20,
                  youtube_checked_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
            args: [result.videoId, song.id],
          });
        }
        found++;
      } else {
        console.log(`${progress} ❌ ${song.title} — ${song.artist} (not found)`);
        if (!DRY_RUN) {
          await db.execute({
            sql: `UPDATE songs SET youtube_status = 'not_found', youtube_checked_at = CURRENT_TIMESTAMP WHERE id = ?`,
            args: [song.id],
          });
        }
        notFound++;
      }
    } catch (e) {
      console.log(`${progress} ⚠️  Error for "${song.title}": ${e.message}`);
      errors++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n=== Done ===`);
  console.log(`✅ Found:     ${found}`);
  console.log(`❌ Not found: ${notFound}`);
  console.log(`⚠️  Errors:   ${errors}`);
  if (DRY_RUN) console.log(`\n💡 Dry-run: no DB writes. Remove --dry-run to save.`);
}

main().catch(console.error);
