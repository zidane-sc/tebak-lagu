#!/usr/bin/env node
/**
 * scripts/audit-youtube-embeds.js
 *
 * Scans catalogue songs for YouTube embedding restrictions (Error 101/150)
 * and deleted/private videos (Error 100) using the official YouTube oEmbed API.
 *
 * Usage:
 *   node scripts/audit-youtube-embeds.js [--limit=50] [--offset=0] [--category="Pop"] [--fix] [--dry-run]
 *
 * Status Codes:
 *   200 -> OK (Embedding allowed)
 *   401 -> Unauthorized (Embedding disabled by content owner / Error 101/150)
 *   404 -> Not Found (Video deleted or made private / Error 100)
 */

const { createClient } = require("@libsql/client");
const { isAcceptable, scoreResult } = require("../src/lib/youtube-matcher.js");
const https = require("https");
const path = require("path");

const db = createClient({ url: `file:${path.resolve(__dirname, "../data/tebak_lagu.db")}` });

const LIMIT = parseInt(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || "50");
const OFFSET = parseInt(process.argv.find((a) => a.startsWith("--offset="))?.split("=")[1] || "0");
const CATEGORY_ARG = process.argv.find((a) => a.startsWith("--category="))?.split("=")[1];
const FIX_FLAG = process.argv.includes("--fix");
const DRY_RUN = process.argv.includes("--dry-run");
const DELAY_MS = 250;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function checkOembed(videoId) {
  return new Promise((resolve) => {
    if (!videoId) return resolve(404);
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
        },
      },
      (res) => {
        resolve(res.statusCode || 0);
      }
    );
    req.on("error", () => resolve(0));
    req.setTimeout(8000, () => {
      req.destroy();
      resolve(0);
    });
  });
}

function fetchYouTubeSearch(query) {
  return new Promise((resolve) => {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
          "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
          "Cookie": "CONSENT=YES+1; YSC=x; VISITOR_INFO1_LIVE=x",
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const data = Buffer.concat(chunks).toString("utf-8");
          try {
            const match = data.match(/var ytInitialData = ({.*?});<\/script>/s);
            if (match) {
              const parsed = JSON.parse(match[1]);
              const contents =
                parsed.contents?.twoColumnSearchResultsRenderer?.primaryContents
                  ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
              const titles = [];
              for (const item of contents) {
                const v = item.videoRenderer;
                if (v?.videoId) {
                  titles.push({
                    videoId: v.videoId,
                    title: v.title?.runs?.[0]?.text || "",
                    channel: v.ownerText?.runs?.[0]?.text || "",
                    duration: v.lengthText?.simpleText || "",
                  });
                  if (titles.length >= 6) break;
                }
              }
              if (titles.length > 0) return resolve(titles);
            }
          } catch {}

          const idMatches = [...new Set(data.match(/"videoId":"([a-zA-Z0-9_-]{11})"/g) || [])];
          const results = idMatches.slice(0, 5).map((m) => ({
            videoId: m.replace('"videoId":"', "").replace('"', ""),
            title: "",
            channel: "",
          }));
          resolve(results);
        });
      }
    );
    req.on("error", () => resolve([]));
    req.setTimeout(10000, () => {
      req.destroy();
      resolve([]);
    });
  });
}

async function findEmbeddableAlternative(artist, title, excludeId) {
  const query = `${artist} ${title} official`;
  const candidates = await fetchYouTubeSearch(query);
  if (!candidates.length) return null;

  const scored = candidates
    .filter((c) => c.videoId !== excludeId)
    .map((c) => ({ ...c, score: scoreResult(c, artist, title) }));
  scored.sort((a, b) => b.score - a.score);

  for (const cand of scored) {
    if (!isAcceptable(cand, artist, title)) continue;
    // CRITICAL: verify candidate allows embedding via oEmbed
    const status = await checkOembed(cand.videoId);
    if (status === 200) {
      return cand;
    }
  }
  return null;
}

async function main() {
  console.log(`\n🔍 YouTube Embed Auditor & Auto-Healer`);
  console.log(`   Limit: ${LIMIT} | Offset: ${OFFSET} | Fix: ${FIX_FLAG} | Dry-run: ${DRY_RUN}\n`);

  let sql = `
    SELECT id, title, artist, category, youtube_id, youtube_status
    FROM songs
    WHERE (is_active = 1 OR is_active IS NULL)
      AND youtube_status = 'ready'
      AND youtube_id IS NOT NULL
  `;
  const args = [];
  if (CATEGORY_ARG) {
    sql += ` AND category LIKE ?`;
    args.push(`%${CATEGORY_ARG}%`);
  }
  sql += ` ORDER BY id ASC LIMIT ? OFFSET ?`;
  args.push(LIMIT, OFFSET);

  const res = await db.execute({ sql, args });
  const songs = res.rows;
  console.log(`📋 Found ${songs.length} songs to audit.\n`);

  let okCount = 0;
  let disabledCount = 0;
  let notFoundCount = 0;
  let fixedCount = 0;

  for (let i = 0; i < songs.length; i++) {
    const s = songs[i];
    const status = await checkOembed(s.youtube_id);
    await sleep(DELAY_MS);

    if (status === 200) {
      okCount++;
      process.stdout.write(`  [${i + 1}/${songs.length}] ✓ OK: ${s.artist} - ${s.title}\n`);
      continue;
    }

    const is401 = status === 401;
    const is404 = status === 404;
    if (is401) disabledCount++;
    else if (is404) notFoundCount++;

    const reason = is401 ? "EMBED_DISABLED (401)" : is404 ? "NOT_FOUND (404)" : `HTTP_${status}`;
    console.log(`\n  ⚠️  [${i + 1}/${songs.length}] ${reason}: ${s.artist} - ${s.title} (${s.youtube_id})`);

    if (FIX_FLAG) {
      process.stdout.write(`      Searching embeddable alternative... `);
      const replacement = await findEmbeddableAlternative(s.artist, s.title, s.youtube_id);
      if (replacement) {
        fixedCount++;
        console.log(`Found: ${replacement.videoId} (${replacement.title || "alternative"})`);
        if (!DRY_RUN) {
          await db.execute({
            sql: `UPDATE songs SET youtube_id = ?, youtube_status = 'ready', youtube_checked_at = datetime('now') WHERE id = ?`,
            args: [replacement.videoId, s.id],
          });
          console.log(`      ✓ Saved new youtube_id to database.`);
        } else {
          console.log(`      [dry-run] Would update youtube_id to ${replacement.videoId}`);
        }
      } else {
        console.log(`No embeddable replacement found.`);
        if (!DRY_RUN) {
          await db.execute({
            sql: `UPDATE songs SET youtube_status = ?, youtube_checked_at = datetime('now') WHERE id = ?`,
            args: [is401 ? "embed_disabled" : "not_found", s.id],
          });
          console.log(`      ✓ Marked status as ${is401 ? "embed_disabled" : "not_found"} in database.`);
        }
      }
    } else if (!DRY_RUN) {
      await db.execute({
        sql: `UPDATE songs SET youtube_status = ?, youtube_checked_at = datetime('now') WHERE id = ?`,
        args: [is401 ? "embed_disabled" : "not_found", s.id],
      });
      console.log(`      ✓ Marked status as ${is401 ? "embed_disabled" : "not_found"}.`);
    }
    console.log();
  }

  console.log(`\n══════════════════════════════════════════════`);
  console.log(`📊 Audit Summary:`);
  console.log(`   Total Checked : ${songs.length}`);
  console.log(`   Embed OK (200): ${okCount}`);
  console.log(`   Disabled (401): ${disabledCount}`);
  console.log(`   Not Found (404): ${notFoundCount}`);
  if (FIX_FLAG) {
    console.log(`   Fixed/Replaced: ${fixedCount}`);
  }
  console.log(`══════════════════════════════════════════════\n`);
}

main().catch(console.error);
