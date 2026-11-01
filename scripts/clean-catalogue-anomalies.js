#!/usr/bin/env node
/**
 * scripts/clean-catalogue-anomalies.js
 *
 * 1. Restores accurate Indonesian titles for Bernadya:
 *    - "Hug Me Now!" -> "Peluk Aku Sekarang!"
 *    - "Haven't Had the Chance to Know You" -> "Belum Sempat Kenal"
 *
 * 2. Cleans raw channel/artist prefixes in titles (Tuan Tigabelas, Gigi, Sheila On 7).
 *
 * 3. Deactivates (is_active = 0) foreign search-collision junk in Indonesian categories
 *    (Nostalgia 2000s & Galau Hits).
 *
 * 4. Refreshes artists.song_count and deactivates artists with 0 active songs.
 *
 * 5. Syncs changes to src/data/songs.json so recovery checks remain consistent.
 */

const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, "../data/tebak_lagu.db");
const db = createClient({ url: `file:${DB_PATH}` });
const SNAPSHOT_PATH = path.resolve(__dirname, "../src/data/songs.json");

const BERNADYA_TITLE_FIXES = {
  "bernadya-hug-me-now": {
    title: "Peluk Aku Sekarang!",
    searchQuery: "Peluk Aku Sekarang! Bernadya",
  },
  "bernadya-haven-t-had-the-chance-to-know-you": {
    title: "Belum Sempat Kenal",
    searchQuery: "Belum Sempat Kenal Bernadya",
  },
};

const TITLE_PREFIX_FIXES = {
  "spotify-b1df13ab427c": "Jangan Pergi",
  "spotify-9f3ab2b23a74": "Hujan",
  "tuan13-tuantigabelas-makan": "Makan",
  "tuan13-tuantigabelas-wew": "WeW",
  "tuan13-tuantigabelas-king": "King",
  "tuan13-tuantigabelas-x-diton-king-king": "King (Diton King Edition)",
  "tuan13-tuantigabelas-talari": "Talari",
  "tuan13-tuantigabelas-dirayha-lancang": "Lancang",
  "tuan13-dirayha-ft-tuantigabelas-40gram": "40Gram",
  "tuan13-tuantigabelas-ft-manutized-x-diton-premium-premium": "PREMIUM",
  "tuan13-tuantigabelas-sicknessmp-ft-mary-su-westside": "Westside",
  "tuan13-tuantigabelas-sicknessmp-ooh-la-la": "Ooh La La",
  "tuan13-hullera-ft-ae-op-ca-h-matter-mos-tuan-tigabelas-siapa-lagi": "Siapa Lagi",
  "tuan13-makan-pencu-zoonde-ft-tuantigabelas": "Makan Pencu",
  "tuan13-mic-check-tuantigabelas": "Mic Check",
  "tuan13-faith-ft-sailormoney": "FAITH (feat. SailorMoney)",
  "tuan13-legacy-ft-saykoji-ras-muhamad": "Legacy (feat. Saykoji & Ras Muhamad)",
};

// Fake hallucinated songs with no YouTube or wrong metadata
const BOGUS_SONGS_TO_DEACTIVATE = [
  "spotify-d8faf852fdb7", // "Adu Rayu" by "Gigi" (Gigi never sang Adu Rayu)
  "spotify-946ade8d0455", // "Maju Mundur" by "Tulus" (fake song)
  "spotify-e0aabce2d49a", // "Laguku" by "Mba Mimi" (fake track)
];

// Foreign artists that leaked into Nostalgia 2000s
const NOSTALGIA_FOREIGN_ARTISTS = [
  "ATB", "ATEEZ", "Alan Jackson",
  "Alice Lee, Katie Ladner, Barrett Wilbert Weed & Elle McLemore",
  "Atzmus", "Babes on the Run", "Bagarre", "Bang La Decks",
  "Bethel Music & Jenn Johnson", "Beyoncé", "Brandon Lake",
  "Brent Faiyaz", "Bros Project", "Divi Roxx Kids & Divinity Roxx",
  "Dynoro & Gigi D'Agostino", "Evanescence", "Gigi Perez",
  "Iya Terra", "Javi Vera", "Justin Timberlake", "Kelsea Ballerini",
  "Kendrick Lamar", "Kizz Daniel & Davido", "Kygo", "LeAnn Rimes",
  "Major Lazer", "Martin Solveig & Dragonette", "Megan Moroney",
  "Michael Wong", "Nas", "Noah Cyrus & Billy Ray Cyrus",
  "Noah Cyrus & Leon Bridges", "Noah Kahan", "Oh Wonder",
  "One Direction", "Pearl Jam",
  "Richard Caddock, WRLD, Nitro Fun, Slips & Slurs & Subtact",
  "SLAVES", "Shreya Ghoshal, Osman Mir, Siddharth Mahadevan, Soumil Shringarpure & Priya Saraiya",
  "Spicy Knots", "Stray Kids, Bang Chan & Lee Know", "Su Presencia",
  "Summrs", "TREASURE", "Tasha Cobbs Leonard",
  "Tasha Cobbs Leonard & Kierra Sheard Kelly", "Tay Money",
  "The Enigma TNG", "Tiwa Savage, Kizz Daniel & Young Jonn",
  "Touch and Go", "Tracy Chapman", "Transgresja", "Travis Scott",
  "Tristam", "Vision of Disorder", "Wheatus", "Yaniss Odua",
  "fenix", "hara", "iwrotehaikusaboutcannibalisminyouryearbook",
  "jmancurly", "orange flavored cigarettes", "周震南",
];

// Foreign artists that leaked into Galau Hits
const GALAU_FOREIGN_ARTISTS = [
  "Benelli", "Blonde", "B£AMS", "Dora And Dreamland", "Fonola Band",
  "Karmate", "L'Impératrice, Charlotte Fever & Wugo",
  "Metro Boomin, Quavo, Breskii & YK NIECE", "Polly Money", "R3TO & heysimo",
  "Raisa Díaz", "Sandra Dianne", "Shawn Mendes", "Soweto",
  "Thriftworks", "Tony Terry", "Visit Qatar", "Zack Tabudlo",
];

async function main() {
  console.log("🚀 Starting Catalogue Anomaly Cleanup...\n");

  await db.execute("PRAGMA journal_mode = WAL;");
  await db.execute("PRAGMA busy_timeout = 8000;");

  // 1. Fix Bernadya Translated Titles
  console.log("1. Fixing Bernadya titles...");
  for (const [id, data] of Object.entries(BERNADYA_TITLE_FIXES)) {
    const res = await db.execute({
      sql: "UPDATE songs SET title = ?, search_query = ? WHERE id = ?;",
      args: [data.title, data.searchQuery, id],
    });
    console.log(`   ✓ ${id} -> "${data.title}" (rows: ${res.rowsAffected})`);
  }

  // 2. Clean Prefix in Titles
  console.log("\n2. Cleaning artist prefix in titles...");
  for (const [id, newTitle] of Object.entries(TITLE_PREFIX_FIXES)) {
    const res = await db.execute({
      sql: "UPDATE songs SET title = ?, search_query = title || ' ' || artist WHERE id = ?;",
      args: [newTitle, id],
    });
    console.log(`   ✓ ${id} -> "${newTitle}" (rows: ${res.rowsAffected})`);
  }

  // 3. Deactivate bogus hallucinated songs
  console.log("\n3. Deactivating bogus hallucinated songs...");
  for (const id of BOGUS_SONGS_TO_DEACTIVATE) {
    const res = await db.execute({
      sql: "UPDATE songs SET is_active = 0 WHERE id = ?;",
      args: [id],
    });
    console.log(`   ✓ ${id} marked is_active = 0 (rows: ${res.rowsAffected})`);
  }

  // 4. Deactivate foreign search-collision junk in Nostalgia 2000s
  console.log("\n4. Deactivating foreign artists in Nostalgia 2000s...");
  const nPh = NOSTALGIA_FOREIGN_ARTISTS.map(() => "?").join(",");
  const nRes = await db.execute({
    sql: `UPDATE songs SET is_active = 0 WHERE category = 'Nostalgia 2000s' AND artist IN (${nPh});`,
    args: NOSTALGIA_FOREIGN_ARTISTS,
  });
  console.log(`   ✓ Nostalgia 2000s deactivated: ${nRes.rowsAffected} songs`);

  // 5. Deactivate foreign search-collision junk in Galau Hits
  console.log("\n5. Deactivating foreign artists in Galau Hits...");
  const gPh = GALAU_FOREIGN_ARTISTS.map(() => "?").join(",");
  const gRes = await db.execute({
    sql: `UPDATE songs SET is_active = 0 WHERE category = 'Galau Hits' AND artist IN (${gPh});`,
    args: GALAU_FOREIGN_ARTISTS,
  });
  console.log(`   ✓ Galau Hits deactivated: ${gRes.rowsAffected} songs`);

  // 5b. Deactivate redundant duplicate variants and clean dirty suffixes (e.g. (Live), (Remastered), OST)
  console.log("\n5b. Cleaning dirty title suffixes and deactivating redundant duplicate versions...");
  const allActiveRes = await db.execute(`
    SELECT id, title, artist, category, youtube_id, youtube_status, popularity, is_active
    FROM songs 
    WHERE is_active = 1 OR is_active IS NULL;
  `);

  function cleanTitle(title) {
    let t = title.replace(/\s*[-–—]\s*(?:Unshatter Film Soundtrack|BRO's Studio).*$/i, "");
    const pattern = /\s*(\((?:live|remastered?|ost\.?|original soundtrack|acoustic version|piano version|radio edit|video mix)[^)]*\)|\[[^\]]*(?:official|live|soundtrack|video)[^\]]*\])/gi;
    t = t.replace(pattern, "");
    t = t.replace(/❤️/g, "").replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    return t.replace(/\s+/g, " ").trim();
  }

  const baseMap = new Map();
  for (const row of allActiveRes.rows) {
    const cl = cleanTitle(row.title);
    const key = `${cl.toLowerCase()}:::${row.artist.trim().toLowerCase()}`;
    if (!baseMap.has(key)) baseMap.set(key, []);
    baseMap.get(key).push({ row, cl });
  }

  let dupesDeactivated = 0;
  let titlesCleaned = 0;

  for (const [, entries] of baseMap.entries()) {
    if (entries.length > 1) {
      // Score: prefer original clean title, prefer ready youtube, prefer popularity
      const score = ({ row, cl }) => {
        let sc = 0;
        if (row.title === cl) sc += 1000;
        if (row.youtube_id && row.youtube_status === "ready") sc += 500;
        sc += row.popularity || 0;
        return sc;
      };
      entries.sort((a, b) => score(b) - score(a));
      const winner = entries[0];
      const losers = entries.slice(1);

      if (winner.row.title !== winner.cl) {
        await db.execute({
          sql: "UPDATE songs SET title = ?, search_query = ? || ' ' || artist WHERE id = ?;",
          args: [winner.cl, winner.cl, winner.row.id],
        });
        titlesCleaned++;
      }

      for (const loser of losers) {
        await db.execute({
          sql: "UPDATE songs SET is_active = 0 WHERE id = ?;",
          args: [loser.row.id],
        });
        dupesDeactivated++;
      }
    } else {
      const { row, cl } = entries[0];
      if (row.title !== cl) {
        await db.execute({
          sql: "UPDATE songs SET title = ?, search_query = ? || ' ' || artist WHERE id = ?;",
          args: [cl, cl, row.id],
        });
        titlesCleaned++;
      }
    }
  }
  console.log(`   ✓ Redundant duplicate versions deactivated: ${dupesDeactivated}`);
  console.log(`   ✓ Dirty song titles cleaned: ${titlesCleaned}`);

  // 6. Refresh artists table counts & active status
  console.log("\n6. Refreshing artists table...");
  await db.execute(`
    UPDATE artists SET song_count = (
      SELECT COUNT(*) FROM song_artists sa
      JOIN songs s ON s.id = sa.song_id
      WHERE sa.artist_id = artists.id AND (s.is_active = 1 OR s.is_active IS NULL)
    );
  `);
  await db.execute(`
    UPDATE artists SET is_active = CASE WHEN song_count > 0 THEN 1 ELSE 0 END;
  `);
  console.log("   ✓ artists song_count and is_active refreshed.");

  // 7. Sync snapshot src/data/songs.json
  console.log("\n7. Updating songs.json snapshot...");
  if (fs.existsSync(SNAPSHOT_PATH)) {
    const allDbSongs = await db.execute(`
      SELECT * FROM songs ORDER BY id ASC;
    `);
    const snapshotSongs = allDbSongs.rows.map((r) => {
      let lyricsClues = [];
      try {
        lyricsClues = typeof r.lyrics_clues === "string" ? JSON.parse(r.lyrics_clues) : r.lyrics_clues || [];
      } catch {}
      let hummingMelody = [];
      try {
        hummingMelody = typeof r.humming_melody === "string" ? JSON.parse(r.humming_melody) : r.humming_melody || [];
      } catch {}

      return {
        id: r.id,
        title: r.title,
        artist: r.artist,
        year: r.year,
        category: r.category,
        difficulty: r.difficulty,
        popularity: r.popularity,
        deezer_rank: r.deezer_rank,
        bpm: r.bpm,
        album: r.album,
        album_cover: r.album_cover,
        preview_url: r.preview_url,
        lyrics_clues: lyricsClues,
        humming_melody: hummingMelody,
        search_query: r.search_query,
        start_second: r.start_second,
        youtube_id: r.youtube_id,
        youtube_start_second: r.youtube_start_second,
        youtube_status: r.youtube_status,
        is_active: r.is_active,
      };
    });
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshotSongs, null, 2), "utf-8");
    console.log(`   ✓ songs.json updated with ${snapshotSongs.length} songs (including is_active states).`);
  }

  // Summary counts
  const totalActive = await db.execute("SELECT COUNT(*) c FROM songs WHERE is_active = 1 OR is_active IS NULL;");
  const totalInactive = await db.execute("SELECT COUNT(*) c FROM songs WHERE is_active = 0;");
  console.log(`\n══════════════════════════════════════════════`);
  console.log(`📊 Cleanup Summary:`);
  console.log(`   Total Active Songs  : ${totalActive.rows[0].c}`);
  console.log(`   Total Deactivated   : ${totalInactive.rows[0].c}`);
  console.log(`══════════════════════════════════════════════\n`);
}

main().catch(console.error);
