#!/usr/bin/env node
/**
 * Deep Forensic Auditor for Tebak Lagu Catalogue
 */

const path = require("path");
const { createClient } = require("@libsql/client");

const dbPath = path.resolve(__dirname, "../data/tebak_lagu.db");
const db = createClient({ url: `file:${dbPath}` });

async function deepAudit() {
  console.log("=========================================================");
  console.log("     🔬 DEEP FORENSIC CATALOGUE AUDIT: 4,619 SONGS       ");
  console.log("=========================================================\n");

  const allRes = await db.execute("SELECT * FROM songs;");
  const songs = allRes.rows;
  console.log(`Auditing ${songs.length} total songs...\n`);

  // 1. Check for Western songs leaking into Indonesian categories
  console.log("--- 1. CROSS-CATEGORY LANGUAGE & ARTIST LEAKS ---");
  // Western artists commonly in English
  const englishArtistRegex = /\b(the beatles|queen|taylor swift|ed sheeran|coldplay|maroon 5|bruno mars|billie eilish|adele|rihanna|katy perry|justin bieber|ariana grande|drake|eminem|linkin park|oasis|green day|radiohead|bon jovi|metallica|guns n roses|nirvana|ac\/dc|pink floyd|led zeppelin|u2|michael jackson|madonna|whitney houston|celine dion|elvis presley|frank sinatra)\b/i;
  
  const westernInIndo = songs.filter(s => 
    s.category !== "Western Hits" && englishArtistRegex.test(s.artist || "")
  );
  console.log(`Famous Western Artists in Indonesian categories: ${westernInIndo.length}`);
  if (westernInIndo.length > 0) {
    westernInIndo.slice(0, 10).forEach(s => console.log(`  • "${s.title}" - ${s.artist} (Category: ${s.category})`));
  }

  // Check for Indonesian artists in Western Hits
  const indoArtistRegex = /\b(sheila on 7|dewa 19|peterpan|noah|padi|slank|iwan fals|tulus|raisa|tiara andini|mahalini|lyodra|denny caknan|happy asmara|ndx aka|guyon waton|fiersa besari|hindia|feast|fourtwnty|payung teduh|judika|afgan|rossa|bcl|bunga citra lestari|glenn fredly|andmesh|virgoun|last child|armada|d'masiv|geisha|kerispatih|vagetoz|kangen band|radja|st12|setia band|wali|unguu?|ada band|nidji|j-rocks|kotak|the changcuters|vidi aldiano|rizky febian|yovie|maliq|kahitna)\b/i;
  const indoInWestern = songs.filter(s =>
    s.category === "Western Hits" && indoArtistRegex.test(s.artist || "")
  );
  console.log(`Famous Indonesian Artists in Western Hits: ${indoInWestern.length}`);
  if (indoInWestern.length > 0) {
    indoInWestern.forEach(s => console.log(`  • "${s.title}" - ${s.artist} (Category: ${s.category})`));
  }
  console.log("");

  // 2. Year Anomalies by Category
  console.log("--- 2. CATEGORY vs RELEASE YEAR MISMATCHES ---");
  // Nostalgia 2000s should be ~1998 - 2012
  const nostalgiaOutliers = songs.filter(s => {
    if (s.category !== "Nostalgia 2000s") return false;
    const y = Number(s.year);
    return y < 1995 || y > 2015;
  });
  console.log(`"Nostalgia 2000s" songs released outside 1995-2015: ${nostalgiaOutliers.length}`);
  if (nostalgiaOutliers.length > 0) {
    nostalgiaOutliers.slice(0, 10).forEach(s => console.log(`  • "${s.title}" - ${s.artist} (Year: ${s.year})`));
  }

  // 3. Audio & Preview Deadlines / Short Clips
  console.log("\n--- 3. AUDIO PREVIEW & START SECOND INTEGRITY ---");
  const invalidStartSec = songs.filter(s => {
    const sec = Number(s.start_second || 0);
    return sec < 0 || sec > 25; // preview is only 30s! If start > 25, only 5s remains
  });
  console.log(`Songs with start_second > 25s (risking audio cutoff): ${invalidStartSec.length}`);
  if (invalidStartSec.length > 0) {
    invalidStartSec.slice(0, 5).forEach(s => console.log(`  • "${s.title}" - ${s.artist} (Start: ${s.start_second}s)`));
  }

  // Check unique preview URLs vs total songs (detect duplicate preview audio across different songs)
  const previewMap = new Map();
  let duplicatePreviewUrls = 0;
  for (const s of songs) {
    if (s.preview_url) {
      if (previewMap.has(s.preview_url)) {
        duplicatePreviewUrls++;
      } else {
        previewMap.set(s.preview_url, s.id);
      }
    }
  }
  console.log(`Songs sharing identical preview audio URLs: ${duplicatePreviewUrls}`);

  // 4. Title Suffix Noise & Modifiers
  console.log("\n--- 4. NOISE, REMIX, SPED UP & LIVE TRACKS ---");
  const liveTracks = songs.filter(s => /\b(live(\s+at|\s+in|\s+version|\s+from)?)\b/i.test(s.title || ""));
  const spedUpTracks = songs.filter(s => /\b(sped\s+up|speed\s+up|slowed|reverb|nightcore)\b/i.test(s.title || ""));
  const djRemixTracks = songs.filter(s => /\b(dj\s+remix|tictok\s+remix|tiktok\s+remix|breakbeat|jedag\s+jedug|fungkot)\b/i.test(s.title || ""));
  const tributeCoverTracks = songs.filter(s => /\b(tribute\s+to|cover\s+by|originally\s+performed)\b/i.test(s.title || "") || /\b(tribute\s+to|cover\s+by)\b/i.test(s.artist || ""));

  console.log(`Live concert versions ("Live in...", "Live at..."): ${liveTracks.length}`);
  if (liveTracks.length > 0) liveTracks.slice(0, 5).forEach(s => console.log(`  • "${s.title}" - ${s.artist}`));

  console.log(`Sped Up / Slowed / Nightcore: ${spedUpTracks.length}`);
  if (spedUpTracks.length > 0) spedUpTracks.slice(0, 5).forEach(s => console.log(`  • "${s.title}" - ${s.artist}`));

  console.log(`DJ Remix / TikTok Breakbeat: ${djRemixTracks.length}`);
  if (djRemixTracks.length > 0) djRemixTracks.slice(0, 5).forEach(s => console.log(`  • "${s.title}" - ${s.artist}`));

  console.log(`Cover / Tribute Band tracks: ${tributeCoverTracks.length}`);
  if (tributeCoverTracks.length > 0) tributeCoverTracks.slice(0, 5).forEach(s => console.log(`  • "${s.title}" - ${s.artist}`));

  // 5. In-depth Lyrics Quality (for the 1,614 songs with lyrics)
  console.log("\n--- 5. LYRICS QUALITY FORENSIC AUDIT (1,614 songs) ---");
  let tooShortLyrics = 0;
  let creditMetadataLyrics = 0;
  let nonIndoLatinLyricsInIndoSong = 0;

  for (const s of songs) {
    if (!s.lyrics_clues) continue;
    let parsed;
    try { parsed = JSON.parse(s.lyrics_clues); } catch (e) { continue; }
    if (!Array.isArray(parsed) || parsed.length === 0) continue;

    // Check if total chars is too short
    const fullText = parsed.join(" ");
    if (fullText.length < 30) {
      tooShortLyrics++;
    }

    // Check if lyrics contain songwriter credits rather than lyrics (e.g. "Written by:", "Lyrics by:")
    if (/\b(written by|composed by|produced by|all rights reserved|lyrics licensed)\b/i.test(fullText)) {
      creditMetadataLyrics++;
    }
  }
  console.log(`Lyrics with total text < 30 characters (too short): ${tooShortLyrics}`);
  console.log(`Lyrics containing publisher/writer credits: ${creditMetadataLyrics}`);

  // 6. Very short titles or artists
  console.log("\n--- 6. EXTREME SHORT OR SUSPICIOUS NAMES ---");
  const shortTitles = songs.filter(s => (s.title || "").trim().length <= 2);
  const shortArtists = songs.filter(s => (s.artist || "").trim().length <= 2);
  console.log(`Titles <= 2 characters: ${shortTitles.length}`);
  if (shortTitles.length > 0) shortTitles.forEach(s => console.log(`  • "${s.title}" - ${s.artist} (ID: ${s.id})`));
  console.log(`Artists <= 2 characters: ${shortArtists.length}`);
  if (shortArtists.length > 0) shortArtists.forEach(s => console.log(`  • "${s.title}" - ${s.artist} (ID: ${s.id})`));

  console.log("\n=========================================================");
  console.log("            DEEP AUDIT COMPLETED                         ");
  console.log("=========================================================");
}

deepAudit().catch(console.error);
