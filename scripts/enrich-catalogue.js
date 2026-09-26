#!/usr/bin/env node
/**
 * All-In-One Robust Catalogue Enricher: Deezer + LRCLIB
 * 
 * Enriches songs in SQLite with:
 * 1. Deezer Rank (popularity/difficulty scoring)
 * 2. Deezer BPM (tempo analysis)
 * 3. Deezer Album Title
 * 4. Strict Validated Lyrics (LRCLIB) with anti-spoiler verse selection
 * 
 * Usage:
 *   node scripts/enrich-catalogue.js [--limit=50] [--all] [--delay=250]
 */

const path = require("path");
const { createClient } = require("@libsql/client");

const dbPath = path.resolve(__dirname, "../data/tebak_lagu.db");
const db = createClient({ url: `file:${dbPath}` });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanStringForSearch(str) {
  return (str || "")
    .replace(/\s*\(feat\..*?\)/gi, "")
    .replace(/\s*\[feat\..*?\]/gi, "")
    .replace(/\s*\(with.*?\)/gi, "")
    .replace(/\s*\(from.*?\)/gi, "")
    .replace(/\s*\(remastered.*?\)/gi, "")
    .replace(/\s*\[remastered.*?\]/gi, "")
    .replace(/\s*\(live.*?\)/gi, "")
    .replace(/\s*\[live.*?\]/gi, "")
    .replace(/\s*-\s*single/gi, "")
    .replace(/\s*-\s*ep/gi, "")
    .trim();
}

function calculateDifficulty(rank) {
  if (!rank || rank <= 0) return null;
  if (rank >= 450000) return "easy";
  if (rank >= 120000) return "medium";
  return "hard";
}

async function fetchDeezer(artist, title) {
  const cleanA = cleanStringForSearch(artist.split(/feat\.|,|&/i)[0]);
  const cleanT = cleanStringForSearch(title);
  const query = `${cleanA} ${cleanT}`;

  try {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=3`;
    const res = await fetch(url, { headers: { "User-Agent": "TebakLaguEnricher/2.0" } });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.data || data.data.length === 0) return null;

    const track = data.data[0];
    const deezerRank = track.rank || 0;
    const albumTitle = track.album?.title || null;
    let bpm = 0;

    if (track.id && deezerRank >= 80000) {
      try {
        const trkRes = await fetch(`https://api.deezer.com/track/${track.id}`, {
          headers: { "User-Agent": "TebakLaguEnricher/2.0" },
        });
        if (trkRes.ok) {
          const trkData = await trkRes.json();
          if (trkData.bpm) bpm = Number(trkData.bpm) || 0;
        }
      } catch (e) {}
    }

    return {
      rank: deezerRank,
      bpm,
      album: albumTitle,
      difficulty: calculateDifficulty(deezerRank),
    };
  } catch (err) {
    return null;
  }
}

async function fetchAndValidateLyrics(artist, title) {
  const cleanA = cleanStringForSearch(artist.split(/feat\.|,/i)[0]);
  const cleanT = cleanStringForSearch(title);

  let rawData = null;

  try {
    const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanA)}&track_name=${encodeURIComponent(cleanT)}`;
    const res = await fetch(url, { headers: { "User-Agent": "TebakLaguEnricher/2.0" } });
    if (res.ok) {
      rawData = await res.json();
    } else {
      // Fallback search
      const q = `${cleanA} ${cleanT}`;
      const searchRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, {
        headers: { "User-Agent": "TebakLaguEnricher/2.0" },
      });
      if (searchRes.ok) {
        const searchList = await searchRes.json();
        if (Array.isArray(searchList) && searchList.length > 0) {
          rawData = searchList[0];
        }
      }
    }
  } catch (e) {
    return null;
  }

  if (!rawData) return null;
  if (rawData.instrumental === true) return null;

  const rawText = rawData.plainLyrics || rawData.syncedLyrics || "";
  if (!rawText || rawText.length < 50) return null;

  // Clean lines: strip timestamps and non-lyric metadata
  const lines = rawText.split("\n");
  const cleanedLines = [];

  for (const l of lines) {
    const cleanL = l.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "").trim();
    if (cleanL.length < 4) continue;
    if (/^(written by|composed by|produced by|all rights|lyrics by|album:|artist:)/i.test(cleanL)) continue;
    cleanedLines.append ? null : cleanedLines.push(cleanL);
  }

  if (cleanedLines.length < 6) return null;

  // Stanza chunking into 4 progressive clues (2 lines each)
  const step = Math.max(1, Math.floor(cleanedLines.length / 5));
  let candidateStanzas = [];
  for (let i = 0; i < 4; i++) {
    const idx = i * step;
    if (idx < cleanedLines.length) {
      const stanza = cleanedLines[idx + 1]
        ? `${cleanedLines[idx]}\n${cleanedLines[idx + 1]}`
        : cleanedLines[idx];
      candidateStanzas.push(stanza);
    }
  }

  if (candidateStanzas.length < 2) return null;

  // Anti-Spoiler Check:
  // If Bait 1 contains the exact title word (length > 3), swap with a non-spoiler stanza if available
  const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (titleWords.length > 0 && titleWords.some(tw => candidateStanzas[0].toLowerCase().includes(tw))) {
    // Find a later stanza that does not have the title word
    const safeIdx = candidateStanzas.findIndex((stz, idx) => idx > 0 && !titleWords.some(tw => stz.toLowerCase().includes(tw)));
    if (safeIdx > 0) {
      // Swap so Bait 1 is non-spoiler!
      const temp = candidateStanzas[0];
      candidateStanzas[0] = candidateStanzas[safeIdx];
      candidateStanzas[safeIdx] = temp;
    }
  }

  return candidateStanzas;
}

async function main() {
  const args = process.argv.slice(2);
  let limit = 50;
  let isAll = false;
  let delayMs = 250;
  let lyricsOnly = false;
  let deezerOnly = false;

  for (const arg of args) {
    if (arg.startsWith("--limit=")) {
      limit = parseInt(arg.split("=")[1], 10) || 50;
    } else if (arg === "--all") {
      isAll = true;
    } else if (arg.startsWith("--delay=")) {
      delayMs = parseInt(arg.split("=")[1], 10) || 250;
    } else if (arg === "--lyrics-only") {
      lyricsOnly = true;
    } else if (arg === "--deezer-only") {
      deezerOnly = true;
    }
  }

  console.log("=================================================");
  console.log("   🚀 TEBAK LAGU: DUAL CATALOGUE ENRICHER        ");
  console.log("=================================================");
  console.log(`Database: ${dbPath}`);
  console.log(`Mode: ${lyricsOnly ? "LIRIK SAJA" : deezerOnly ? "DEEZER SAJA" : "DUAL (DEEZER + LIRIK)"}`);
  console.log(`Delay per track: ${delayMs}ms\n`);

  // Target songs based on mode
  const queryLimit = isAll ? 5000 : limit;

  let whereClause = "(deezer_rank IS NULL OR deezer_rank = 0) OR (lyrics_clues IS NULL OR length(lyrics_clues) < 15)";
  if (lyricsOnly) {
    whereClause = "lyrics_clues IS NULL OR length(lyrics_clues) < 15 OR lyrics_clues = '[]'";
  } else if (deezerOnly) {
    whereClause = "deezer_rank IS NULL OR deezer_rank = 0";
  }

  const songsRes = await db.execute({
    sql: `
      SELECT id, title, artist, category, difficulty, deezer_rank, album, lyrics_clues
      FROM songs
      WHERE ${whereClause}
      ORDER BY times_played DESC, id ASC
      LIMIT ?;
    `,
    args: [queryLimit],
  });

  const songs = songsRes.rows;
  console.log(`Found ${songs.length} songs needing enrichment in this run.\n`);

  let deezerSuccess = 0;
  let lyricsSuccess = 0;

  for (let i = 0; i < songs.length; i++) {
    const s = songs[i];
    const progress = `[${i + 1}/${songs.length}]`;
    let deezerLog = "Deezer: -";
    let lyricsLog = "Lyrics: -";

    const needsDeezer = !s.deezer_rank || Number(s.deezer_rank) === 0;
    const needsLyrics = !s.lyrics_clues || s.lyrics_clues.length < 15;

    let updatedRank = s.deezer_rank || 0;
    let updatedBpm = 0;
    let updatedAlbum = s.album || null;
    let updatedDifficulty = s.difficulty || "easy";
    let updatedLyrics = s.lyrics_clues || null;

    // 1. Enrich Deezer if needed
    if (needsDeezer) {
      const dData = await fetchDeezer(s.artist, s.title);
      if (dData && dData.rank > 0) {
        updatedRank = dData.rank;
        updatedBpm = dData.bpm;
        if (dData.album) updatedAlbum = dData.album;
        if (dData.difficulty) updatedDifficulty = dData.difficulty;
        deezerLog = `Deezer: Rank ${dData.rank} (${updatedDifficulty})${dData.bpm ? `, BPM ${dData.bpm}` : ""}`;
        deezerSuccess++;
      } else {
        deezerLog = "Deezer: ❌";
      }
    } else {
      deezerLog = "Deezer: ✓ (Skip)";
    }

    // 2. Enrich Lyrics if needed
    if (needsLyrics) {
      const lClues = await fetchAndValidateLyrics(s.artist, s.title);
      if (lClues && lClues.length >= 2) {
        updatedLyrics = JSON.stringify(lClues);
        lyricsLog = `Lyrics: ✅ (${lClues.length} Bait)`;
        lyricsSuccess++;
      } else {
        lyricsLog = "Lyrics: ❌";
      }
    } else {
      lyricsLog = "Lyrics: ✓ (Skip)";
    }

    // Commit to SQLite
    await db.execute({
      sql: `
        UPDATE songs 
        SET deezer_rank = ?, bpm = ?, album = ?, difficulty = ?, lyrics_clues = ?
        WHERE id = ?;
      `,
      args: [updatedRank, updatedBpm, updatedAlbum, updatedDifficulty, updatedLyrics, s.id],
    });

    console.log(`${progress} "${s.title}" - ${s.artist} | ${deezerLog} | ${lyricsLog}`);

    if (i < songs.length - 1) {
      await sleep(delayMs);
    }
  }

  console.log("\n=================================================");
  console.log("            ENRICHMENT RUN FINISHED              ");
  console.log("=================================================");
  console.log(`Songs processed: ${songs.length}`);
  console.log(`Deezer enriched: ${deezerSuccess}`);
  console.log(`Lyrics enriched: ${lyricsSuccess}`);
  console.log("Database updated cleanly!");
}

main().catch(console.error);
