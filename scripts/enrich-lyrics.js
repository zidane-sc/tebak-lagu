#!/usr/bin/env node
/**
 * Offline / Background Lyrics Enrichment Script
 * Fetches lyrics from LRCLIB for songs missing lyrics in SQLite,
 * cleans timestamps, strips spoiler lines, chunks into 4 progressive clues,
 * and updates the database.
 * 
 * Usage:
 *   node scripts/enrich-lyrics.js [--limit=50] [--all] [--delay=350]
 */

const path = require("path");
const { createClient } = require("@libsql/client");

const dbPath = path.resolve(__dirname, "../data/tebak_lagu.db");
const db = createClient({
  url: `file:${dbPath}`,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchLyrics(artist, title) {
  try {
    const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
    let res = await fetch(url, { headers: { "User-Agent": "TebakLaguEnricher/1.0" } });
    
    if (!res.ok) {
      // Fallback search query
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${title}`)}`;
      const searchRes = await fetch(searchUrl, { headers: { "User-Agent": "TebakLaguEnricher/1.0" } });
      if (searchRes.ok) {
        const results = await searchRes.json();
        if (Array.isArray(results) && results.length > 0 && (results[0].plainLyrics || results[0].syncedLyrics)) {
          return results[0].plainLyrics || results[0].syncedLyrics;
        }
      }
      return null;
    }

    const data = await res.json();
    return data.plainLyrics || data.syncedLyrics || null;
  } catch (err) {
    return null;
  }
}

function processLyricsToClues(rawText, title, artist) {
  if (!rawText) return null;

  // Strip timestamps: [00:12.34]
  const cleanLines = rawText
    .split("\n")
    .map((l) => l.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "").trim())
    .filter((l) => l.length > 5 && !l.startsWith("[") && !l.endsWith("]"));

  if (cleanLines.length < 4) return null;

  // Filter out lines that give away the title or artist directly
  const titleWords = title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const nonRevealing = cleanLines.filter((l) => {
    const lLow = l.toLowerCase();
    return (
      !titleWords.some((w) => lLow.includes(w)) &&
      !lLow.includes(artist.toLowerCase())
    );
  });

  const targetLines = nonRevealing.length >= 4 ? nonRevealing : cleanLines;

  // Divide into 4 distinct progressive clues (2 lines per clue)
  const clues = [];
  const step = Math.max(1, Math.floor(targetLines.length / 5));
  for (let i = 0; i < 4; i++) {
    const idx = i * step;
    if (idx < targetLines.length) {
      if (idx + 1 < targetLines.length) {
        clues.push(`${targetLines[idx]}\n${targetLines[idx + 1]}`);
      } else {
        clues.push(targetLines[idx]);
      }
    }
  }

  return clues.length >= 2 ? clues : null;
}

async function main() {
  const args = process.argv.slice(2);
  let limit = 50;
  let isAll = false;
  let delayMs = 350;

  for (const arg of args) {
    if (arg.startsWith("--limit=")) {
      limit = parseInt(arg.split("=")[1], 10) || 50;
    } else if (arg === "--all") {
      isAll = true;
    } else if (arg.startsWith("--delay=")) {
      delayMs = parseInt(arg.split("=")[1], 10) || 350;
    }
  }

  console.log("=== TEBAK LAGU: LYRICS ENRICHMENT TOOL ===");
  console.log(`Database: ${dbPath}`);
  console.log(`Delay per request: ${delayMs}ms`);

  const countRes = await db.execute(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN lyrics_clues IS NOT NULL AND length(lyrics_clues) > 15 AND lyrics_clues != '[]' THEN 1 ELSE 0 END) as with_lyrics
    FROM songs;
  `);

  const total = Number(countRes.rows[0].total);
  const withLyrics = Number(countRes.rows[0].with_lyrics);
  const withoutLyrics = total - withLyrics;

  console.log(`Total songs: ${total}`);
  console.log(`Already has lyrics: ${withLyrics}`);
  console.log(`Missing lyrics: ${withoutLyrics}`);

  if (withoutLyrics === 0) {
    console.log("All songs already have lyrics! Nothing to do.");
    return;
  }

  const queryLimit = isAll ? withoutLyrics : limit;
  console.log(`Targeting ${queryLimit} songs for this run...\n`);

  const songsRes = await db.execute({
    sql: `
      SELECT id, title, artist 
      FROM songs 
      WHERE lyrics_clues IS NULL OR length(lyrics_clues) < 15 OR lyrics_clues = '[]'
      ORDER BY times_played DESC, id ASC
      LIMIT ?;
    `,
    args: [queryLimit],
  });

  const songs = songsRes.rows;
  let successCount = 0;
  let notFoundCount = 0;

  for (let i = 0; i < songs.length; i++) {
    const s = songs[i];
    const progress = `[${i + 1}/${songs.length}]`;
    process.stdout.write(`${progress} Searching lyrics: "${s.title}" - ${s.artist}... `);

    const raw = await fetchLyrics(s.artist, s.title);
    if (!raw) {
      console.log("❌ Not Found");
      notFoundCount++;
    } else {
      const clues = processLyricsToClues(raw, s.title, s.artist);
      if (!clues || clues.length === 0) {
        console.log("⚠️ Too short / unparseable");
        notFoundCount++;
      } else {
        const jsonClues = JSON.stringify(clues);
        await db.execute({
          sql: "UPDATE songs SET lyrics_clues = ? WHERE id = ?;",
          args: [jsonClues, s.id],
        });
        console.log(`✅ Saved (${clues.length} bait)`);
        successCount++;
      }
    }

    if (i < songs.length - 1) {
      await sleep(delayMs);
    }
  }

  console.log("\n=== ENRICHMENT SUMMARY ===");
  console.log(`Successfully enriched: ${successCount} songs`);
  console.log(`Not found / skipped: ${notFoundCount} songs`);
  console.log("Done! Database updated.");
}

main().catch(console.error);
