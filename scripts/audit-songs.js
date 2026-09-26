#!/usr/bin/env node
/**
 * Comprehensive Songs Catalogue Auditor
 * Audits all 4,619+ songs in SQLite for:
 * 1. Duplicate titles & artists
 * 2. Missing or broken audio preview URLs
 * 3. Weird/garbled titles, HTML entities, test records
 * 4. Karaoke / Instrumental / Sound effect noise
 * 5. Lyrics status, corrupted JSON, placeholder/dummy text, title spoilers
 * 6. Year, Category, and Album Cover integrity
 */

const path = require("path");
const { createClient } = require("@libsql/client");

const dbPath = path.resolve(__dirname, "../data/tebak_lagu.db");
const db = createClient({ url: `file:${dbPath}` });

function cleanStr(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

async function runAudit() {
  console.log("=================================================");
  console.log("   🔍 TEBAK LAGU: COMPREHENSIVE CATALOGUE AUDIT   ");
  console.log("=================================================");
  console.log(`Database: ${dbPath}\n`);

  // 1. Total songs
  const totalRes = await db.execute("SELECT COUNT(*) as count FROM songs;");
  const totalSongs = Number(totalRes.rows[0].count);
  console.log(`📊 Total Songs in Database: ${totalSongs}\n`);

  // 2. Duplicates Audit
  console.log("--- 1. DUPLICATE AUDIT ---");
  const allSongsRes = await db.execute("SELECT id, title, artist, year, category, preview_url, lyrics_clues, album_cover FROM songs;");
  const songs = allSongsRes.rows;

  const seenMap = new Map(); // cleanKey -> [songs]
  for (const s of songs) {
    const key = `${cleanStr(s.title)}:::${cleanStr(s.artist)}`;
    if (!seenMap.has(key)) seenMap.set(key, []);
    seenMap.get(key).push(s);
  }

  let duplicateClusters = 0;
  let totalDuplicateRows = 0;
  const duplicateSamples = [];

  for (const [key, cluster] of seenMap.entries()) {
    if (cluster.length > 1) {
      duplicateClusters++;
      totalDuplicateRows += cluster.length - 1;
      if (duplicateSamples.length < 5) {
        duplicateSamples.push({
          key,
          count: cluster.length,
          titles: cluster.map(c => `"${c.title}" - ${c.artist} (ID: ${c.id})`),
        });
      }
    }
  }

  console.log(`Exact/Clean Duplicate Clusters: ${duplicateClusters}`);
  console.log(`Redundant Duplicate Rows: ${totalDuplicateRows}`);
  if (duplicateSamples.length > 0) {
    console.log("Sample duplicates:");
    duplicateSamples.forEach(d => {
      console.log(`  • [${d.count}x] ${d.titles.join("  vs  ")}`);
    });
  }
  console.log("");

  // 3. Audio Preview URL Integrity
  console.log("--- 2. AUDIO PREVIEW URL INTEGRITY ---");
  const noPreview = songs.filter(s => !s.preview_url || s.preview_url.trim() === "" || s.preview_url === "null");
  const nonHttpPreview = songs.filter(s => s.preview_url && !s.preview_url.startsWith("http"));
  console.log(`Missing Preview URLs: ${noPreview.length}`);
  console.log(`Malformed Preview URLs (not http): ${nonHttpPreview.length}`);
  if (noPreview.length > 0 && noPreview.length <= 5) {
    noPreview.forEach(s => console.log(`  • "${s.title}" - ${s.artist} (ID: ${s.id})`));
  }
  console.log("");

  // 4. Garbage / HTML Entities / Noise in Title & Artist
  console.log("--- 3. TITLE & ARTIST HYGIENE ---");
  const htmlEntities = songs.filter(s => 
    /(&amp;|&quot;|&#39;|&lt;|&gt;|&apos;)/i.test(s.title || "") || 
    /(&amp;|&quot;|&#39;|&lt;|&gt;|&apos;)/i.test(s.artist || "")
  );
  console.log(`Titles/Artists with raw HTML entities (&amp;, &#39;, etc): ${htmlEntities.length}`);
  if (htmlEntities.length > 0) {
    console.log("Sample HTML entity anomalies:");
    htmlEntities.slice(0, 5).forEach(s => console.log(`  • "${s.title}" - ${s.artist}`));
  }

  // Suspicious titles (e.g. instrumental, backing track, sound effect, test)
  const suspiciousKeywords = ["(instrumental)", "[instrumental]", "(karaoke)", "[karaoke]", "(backing track)", "sound effect", "ringtone", "test"];
  const suspiciousSongs = songs.filter(s => {
    const t = (s.title || "").toLowerCase();
    return suspiciousKeywords.some(k => t.includes(k));
  });
  console.log(`Suspicious Titles (Instrumental/Karaoke/SoundFX): ${suspiciousSongs.length}`);
  if (suspiciousSongs.length > 0) {
    suspiciousSongs.slice(0, 5).forEach(s => console.log(`  • "${s.title}" - ${s.artist}`));
  }
  console.log("");

  // 5. Lyrics Integrity
  console.log("--- 4. LYRICS INTEGRITY ---");
  let validLyricsCount = 0;
  let emptyLyricsCount = 0;
  let corruptedJsonCount = 0;
  let dummyTextCount = 0;
  let spoilerLyricsCount = 0;

  const dummyPhrases = [
    "tebak judul lagu",
    "dengarkan lirik",
    "lirik belum tersedia",
    "instrumental",
    "lirik tidak tersedia",
  ];

  for (const s of songs) {
    if (!s.lyrics_clues || s.lyrics_clues.trim() === "" || s.lyrics_clues === "null") {
      emptyLyricsCount++;
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(s.lyrics_clues);
    } catch (e) {
      corruptedJsonCount++;
      continue;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      emptyLyricsCount++;
      continue;
    }

    // Check for dummy text
    const allText = parsed.join(" ").toLowerCase();
    if (dummyPhrases.some(p => allText.includes(p))) {
      dummyTextCount++;
    }

    // Check if the FIRST stanza gives away the entire title directly
    const firstStanza = (parsed[0] || "").toLowerCase();
    const cleanTitle = (s.title || "").toLowerCase().trim();
    if (cleanTitle.length > 3 && firstStanza.includes(cleanTitle)) {
      spoilerLyricsCount++;
    }

    validLyricsCount++;
  }

  console.log(`Valid Lyrics Available: ${validLyricsCount} (${((validLyricsCount/totalSongs)*100).toFixed(1)}%)`);
  console.log(`Empty / Missing Lyrics: ${emptyLyricsCount} (${((emptyLyricsCount/totalSongs)*100).toFixed(1)}%)`);
  console.log(`Corrupted JSON Lyrics: ${corruptedJsonCount}`);
  console.log(`Dummy / Placeholder Text Lyrics: ${dummyTextCount}`);
  console.log(`First Stanza Contains Exact Song Title (Spoiler): ${spoilerLyricsCount}`);
  console.log("");

  // 6. Year, Category & Album Cover Integrity
  console.log("--- 5. METADATA INTEGRITY ---");
  const invalidYears = songs.filter(s => !s.year || Number(s.year) < 1960 || Number(s.year) > 2026);
  const missingCovers = songs.filter(s => !s.album_cover || s.album_cover.trim() === "");
  const uncategorized = songs.filter(s => !s.category || s.category.trim() === "" || s.category === "Uncategorized");

  console.log(`Songs with Invalid/Unrealistic Year (<1960 or >2026): ${invalidYears.length}`);
  console.log(`Songs without Album Cover: ${missingCovers.length}`);
  console.log(`Songs without Valid Category: ${uncategorized.length}`);

  // Summary categories breakdown
  const catMap = {};
  for (const s of songs) {
    const c = s.category || "Unknown";
    catMap[c] = (catMap[c] || 0) + 1;
  }
  console.log("\nGenre / Category Distribution:");
  Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`  • ${cat}: ${count} lagu`);
    });

  console.log("\n=================================================");
  console.log("             AUDIT RUN COMPLETED                 ");
  console.log("=================================================");
}

runAudit().catch(console.error);
