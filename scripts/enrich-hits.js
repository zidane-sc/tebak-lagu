const { createClient } = require("@libsql/client");
const path = require("path");
const fs = require("fs");

const dbPath = path.resolve(__dirname, "../data/tebak_lagu.db");
const db = createClient({ url: `file:${dbPath}` });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanString(str) {
  return (str || "")
    .replace(/\s*[\(\[].*?[\)\]]/g, "")
    .replace(/\s*-\s*single/gi, "")
    .replace(/\s*-\s*ep/gi, "")
    .replace(/['"\.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchLyrics(artist, title) {
  const cleanA = cleanString(artist.split(/feat\.|,|&/i)[0]);
  const cleanT = cleanString(title);
  const q = `${cleanA} ${cleanT}`;

  let rawData = null;

  try {
    // 1. Direct get
    const getUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanA)}&track_name=${encodeURIComponent(cleanT)}`;
    const getRes = await fetch(getUrl, { headers: { "User-Agent": "TebakLaguHits/1.0" } });
    if (getRes.ok) {
      rawData = await getRes.json();
    } else {
      // 2. Search query
      const sUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`;
      const sRes = await fetch(sUrl, { headers: { "User-Agent": "TebakLaguHits/1.0" } });
      if (sRes.ok) {
        const list = await sRes.json();
        if (Array.isArray(list) && list.length > 0) {
          rawData = list[0];
        }
      }
    }
  } catch (e) {
    return null;
  }

  if (!rawData || rawData.instrumental === true) return null;

  const rawText = rawData.plainLyrics || rawData.syncedLyrics || "";
  if (!rawText || rawText.length < 50) return null;

  const lines = rawText
    .split("\n")
    .map((l) => l.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "").trim())
    .filter((l) => l.length > 3 && !/^(written|composed|produced|all rights|lyrics by|album:|artist:)/i.test(l));

  if (lines.length < 8) return null;

  const step = Math.max(1, Math.floor(lines.length / 5));
  const stanzas = [];
  for (let i = 0; i < 4; i++) {
    const idx = i * step;
    if (idx < lines.length) {
      stanzas.push(lines[idx + 1] ? `${lines[idx]}\n${lines[idx + 1]}` : lines[idx]);
    }
  }

  if (stanzas.length < 4) return null;

  // Anti-spoiler smart shift
  const titleWords = title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  if (titleWords.length > 0 && titleWords.some((tw) => stanzas[0].toLowerCase().includes(tw))) {
    const safeIdx = stanzas.findIndex((stz, idx) => idx > 0 && !titleWords.some((tw) => stz.toLowerCase().includes(tw)));
    if (safeIdx > 0) {
      const temp = stanzas[0];
      stanzas[0] = stanzas[safeIdx];
      stanzas[safeIdx] = temp;
    }
  }

  return stanzas;
}

async function run() {
  console.log("=================================================");
  console.log("   🚀 ENRICHING POPULAR SONGS WITH 4-STANZA LYRICS");
  console.log("=================================================");

  const res = await db.execute(`
    SELECT id, title, artist, category 
    FROM songs 
    WHERE lyrics_clues IS NULL OR json_array_length(lyrics_clues) < 4
    ORDER BY id ASC;
  `);

  const songs = res.rows;
  console.log(`Found ${songs.length} remaining songs without 4 stanzas.\n`);

  let success = 0;

  for (let i = 0; i < songs.length; i++) {
    const s = songs[i];
    const progress = `[${i + 1}/${songs.length}]`;

    const stanzas = await fetchLyrics(s.artist, s.title);
    if (stanzas && stanzas.length === 4) {
      await db.execute({
        sql: "UPDATE songs SET lyrics_clues = ? WHERE id = ?;",
        args: [JSON.stringify(stanzas), s.id],
      });
      console.log(`${progress} ✅ "${s.title}" - ${s.artist} (4 Bait Enriched)`);
      success++;
    } else {
      console.log(`${progress} ❌ "${s.title}" - ${s.artist} (Not in LRCLIB)`);
    }

    await sleep(150);
  }

  console.log("\n=================================================");
  console.log(`FINISHED: ${success}/${songs.length} songs enriched with 4 stanzas!`);
  console.log("=================================================");
}

run().catch(console.error);
