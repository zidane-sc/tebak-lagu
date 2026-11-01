#!/usr/bin/env node
/**
 * scripts/clean-catalogue-anomalies.js
 *
 * Comprehensive catalogue remediation script:
 * 1. Restores accurate Indonesian titles for Bernadya:
 *    - "Hug Me Now!" -> "Peluk Aku Sekarang!"
 *    - "Haven't Had the Chance to Know You" -> "Belum Sempat Kenal"
 *
 * 2. Corrects truncated titles:
 *    - "Hujan" (Sheila On 7) -> "Hujan Turun"
 *    - Cleans raw artist prefixes in Tuan Tigabelas titles.
 *
 * 3. Enriches iconic hits missing lyrics or YouTube:
 *    - Bento (Iwan Fals): assigns official YouTube video (JC7ycpTqcRo) and 4-stanza lyrics.
 *    - Bintang Di Surga, Sisa Rasa, Pesan Terakhir, Hati-Hati di Jalan, Sampai Jumpa,
 *      Kartonyono Medot Janji, Mendung Tanpo Udan, Blinding Lights, Someone Like You:
 *      backfills 4-stanza lyrics for Robot TTS.
 *
 * 4. Deactivates phantom/hallucinated tracks that never existed or are unplayable.
 *
 * 5. Deactivates foreign search-collision tracks in Indonesian categories.
 *
 * 6. Cleans dirty metadata suffixes (e.g. (From "..."), (Remastered...), [Radio Edit], (OST...))
 *    and deactivates redundant duplicate variants (Live, Acoustic, Demo) when a clean studio track exists.
 *
 * 7. Refreshes artists table and syncs src/data/songs.json snapshot.
 */

const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, "../data/tebak_lagu.db");
const db = createClient({ url: `file:${DB_PATH}` });
const SNAPSHOT_PATH = path.resolve(__dirname, "../src/data/songs.json");

const TITLE_FIXES = {
  "bernadya-hug-me-now": {
    title: "Peluk Aku Sekarang!",
    searchQuery: "Peluk Aku Sekarang! Bernadya",
  },
  "bernadya-haven-t-had-the-chance-to-know-you": {
    title: "Belum Sempat Kenal",
    searchQuery: "Belum Sempat Kenal Bernadya",
  },
  "spotify-9f3ab2b23a74": {
    title: "Hujan Turun",
    searchQuery: "Hujan Turun Sheila On 7",
  },
  "tuan13-tuantigabelas-makan": { title: "Makan", searchQuery: "Makan Tuan Tigabelas" },
  "tuan13-tuantigabelas-wew": { title: "WeW", searchQuery: "WeW Tuan Tigabelas" },
  "tuan13-tuantigabelas-king": { title: "King", searchQuery: "King Tuan Tigabelas" },
  "tuan13-tuantigabelas-x-diton-king-king": { title: "King (Diton King Edition)", searchQuery: "King Diton King Edition Tuan Tigabelas" },
  "tuan13-tuantigabelas-talari": { title: "Talari", searchQuery: "Talari Tuan Tigabelas" },
  "tuan13-tuantigabelas-dirayha-lancang": { title: "Lancang", searchQuery: "Lancang Tuan Tigabelas" },
  "tuan13-dirayha-ft-tuantigabelas-40gram": { title: "40Gram", searchQuery: "40Gram Tuan Tigabelas" },
  "tuan13-tuantigabelas-ft-manutized-x-diton-premium-premium": { title: "PREMIUM", searchQuery: "PREMIUM Tuan Tigabelas" },
  "tuan13-tuantigabelas-sicknessmp-ft-mary-su-westside": { title: "Westside", searchQuery: "Westside Tuan Tigabelas" },
  "tuan13-tuantigabelas-sicknessmp-ooh-la-la": { title: "Ooh La La", searchQuery: "Ooh La La Tuan Tigabelas" },
  "tuan13-hullera-ft-ae-op-ca-h-matter-mos-tuan-tigabelas-siapa-lagi": { title: "Siapa Lagi", searchQuery: "Siapa Lagi Tuan Tigabelas" },
  "tuan13-makan-pencu-zoonde-ft-tuantigabelas": { title: "Makan Pencu", searchQuery: "Makan Pencu Tuan Tigabelas" },
  "tuan13-mic-check-tuantigabelas": { title: "Mic Check", searchQuery: "Mic Check Tuan Tigabelas" },
  "tuan13-faith-ft-sailormoney": { title: "FAITH (feat. SailorMoney)", searchQuery: "FAITH SailorMoney Tuan Tigabelas" },
  "tuan13-legacy-ft-saykoji-ras-muhamad": { title: "Legacy (feat. Saykoji & Ras Muhamad)", searchQuery: "Legacy Saykoji Ras Muhamad Tuan Tigabelas" },
};

// Phantom or broken duplicate tracks that cannot be played or never existed
const PHANTOM_TRACKS = [
  "spotify-d8faf852fdb7", // "Adu Rayu" by Gigi (fake)
  "spotify-946ade8d0455", // "Maju Mundur" by Tulus (fake)
  "spotify-e0aabce2d49a", // "Laguku" by Mba Mimi (fake)
  "spotify-6204f3f414e2", // "Mengapa" by Chrisye (fake)
  "spotify-5475f76db4c6", // "Aku Bukan Dia" by Tiara Andini (fake)
  "spotify-2e6e4b67e0fd", // "Bukan Suka-Suka" by Ghea Indrawari (fake)
  "spotify-b1df13ab427c", // "Jangan Pergi" by Gigi (fake)
  "spotify-b6b1cd5ea57d", // "Rungkad" by Denny Caknan (phantom duplicate of Happy Asmara / Yeni Inka)
];

// Lyrics backfill for iconic tracks so they are playable in Robot TTS
const LYRICS_BACKFILL = {
  "spotify-7d8dd0fc851f": {
    // Bento - Iwan Fals
    youtube_id: "JC7ycpTqcRo",
    youtube_status: "ready",
    youtube_start_second: 20,
    lyrics: [
      "Namaku Bento, rumah real estate\nMobilku banyak, harta melimpah",
      "Orang memanggilku bos eksekutif\nTokoh papan atas, atas segalanya",
      "Asik!\nWajahku ganteng, banyak simpanan",
      "Sekali lirik, oke sajalah\nBisnisku menjegal, jagal apa saja",
    ],
  },
  "spotify-75bbc8ada7e3": {
    // Bintang Di Surga - Peterpan
    lyrics: [
      "Masih ku merasa lelah\nKenyataan hidup tanpa cinta",
      "Takkan pernah ada rasa sepi\nBila kau slalu di sampingku",
      "Bagai bintang di surga\nMemberikan sinar terang",
      "Menghapus duka lara\nMenyambut fajar cinta",
    ],
  },
  "spotify-4a06534c2a57": {
    // Sisa Rasa - Mahalini
    lyrics: [
      "Melihatmu bahagia, satu hal yang terindah\nAnugerah cinta abadi untuk selamanya",
      "Tuhan yakinkan dia bahagia\nWalau ku tak bersamanya lagi",
      "Mengapa ku masih menaruh rasa\nDi saat kau telah melupakanku",
      "Kini hanya tersisa rasa sepi\nYang takkan pernah pudar di hati",
    ],
  },
  "spotify-2673a3c1e104": {
    // Pesan Terakhir - Lyodra
    lyrics: [
      "Telah kucoba merelakanmu\nNamun bayangmu slalu ada",
      "Genggam tanganku untuk yang terakhir\nSebelum ku benar-benar pergi",
      "Ku kan menghilang dari hidupmu\nMenghapus setiap jejak kenangan",
      "Bila suatu saat nanti kau rindu\nIngatlah aku pernah mencintaimu",
    ],
  },
  "spotify-25ad9ee2185b": {
    // Hati-Hati di Jalan - Tulus
    lyrics: [
      "Perjalanan membawamu\nBertemu denganku ku bertemu kamu",
      "Sepertinya sama dan sejalan\nKukira kita asam dan garam",
      "Kukira kita akan bersama\nBegitu banyak yang sama",
      "Hati-hati di jalan\nSemoga kau temukan yang kau cari",
    ],
  },
  "spotify-e2abc3db3853": {
    // Sampai Jumpa - Endank Soekamti
    lyrics: [
      "Datang akan pergi\nLewat kan berlalu",
      "Ada dan tiada\nBertemu akan berpisah",
      "Meskipun ku belum siap untuk merindu\nKu belum siap tanpa dirimu",
      "Sampai jumpa di lain hari\nUntuk kita bertemu lagi",
    ],
  },
  "spotify-9f3ab2b23a74": {
    // Hujan Turun - Sheila On 7
    lyrics: [
      "Kala hujan turun membasahi bumi\nKu terdiam menatap jendela",
      "Mengingat saat indah bersamamu\nKisah lama yang takkan terlupa",
      "Hujan turun basahi luka di hati\nMenghanyutkan semua kenangan ini",
      "Kuingin kau kembali ke pelukanku\nMenemani sepi di malam dingin",
    ],
  },
  "spotify-da115180b8b6": {
    // Kartonyono Medot Janji - Denny Caknan
    lyrics: [
      "Kok kebangeten men\nSambat blas raono syukure",
      "Suwe-suwe sopo sing betah ngrasakke\nMung dadi pelampiasan katresnan",
      "Kartonyono neng ngawi medot janjimu\nAmbruk cagak ku nuruti angen-angenmu",
      "Sak kabehane wes tak turuti\nTapi koe malah milih liyane",
    ],
  },
  "spotify-7566a684d54a": {
    // Mendung Tanpo Udan - Ndarboy Genk
    lyrics: [
      "Mendung tanpo udan\nKetemu lan kelangan",
      "Kabeh kui sing diarani lelakon\nAwak dewe mung iso pasrah",
      "Ngapuro aku wes gawe loro atimu\nAku durung iso dadi sing mbok karepke",
      "Mugo koe nemu tresno liyane\nSing iso gawe bungah atimu",
    ],
  },
  "spotify-cb14e0b4613d": {
    // Blinding Lights - The Weeknd
    lyrics: [
      "I've been on my own for long enough\nMaybe you can show me how to love maybe",
      "I'm going through withdrawals\nYou don't even have to do too much",
      "I'm blinded by the lights\nNo I can't sleep until I feel your touch",
      "I said ooh I'm drowning in the night\nOh when I'm like this you're the one I trust",
    ],
  },
  "spotify-7f0412aba24b": {
    // Someone Like You - Adele
    lyrics: [
      "I heard that you're settled down\nThat you found a girl and you're married now",
      "I heard that your dreams came true\nGuess she gave you things I didn't give to you",
      "Never mind I'll find someone like you\nI wish nothing but the best for you too",
      "Don't forget me I beg I'll remember you said\nSometimes it lasts in love but sometimes it hurts instead",
    ],
  },
};

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

// Patterns for metadata noise in titles
const NOISE_PATTERNS = [
  /\s*\((?:From|from)\s+[^)]+\)/gi,
  /\s*\[(?:From|from)\s+[^\]]+\]/gi,
  /\s*\((?:ost\.?|original soundtrack)[^)]*\)/gi,
  /\s*\[(?:ost\.?|original soundtrack)[^\]]*\]/gi,
  /\s*\((?:\d{4}\s+)?(?:remaster(?:ed)?|mix|edit|version|acoustic|accoustic|piano|stripped|orchestra|radio|demo|live|session|koplo|dj|unplugged|bonus|extended|mono|stereo)[^)]*\)/gi,
  /\s*\[(?:\d{4}\s+)?(?:remaster(?:ed)?|mix|edit|version|acoustic|accoustic|piano|stripped|orchestra|radio|demo|live|session|koplo|dj|unplugged|bonus|extended|mono|stereo|official)[^\]]*\]/gi,
  /\s*\((?:remix|rework|bootleg)[^)]*\)/gi,
  /\s*\[(?:remix|rework|bootleg)[^\]]*\]/gi,
  /\s*\((?:bonus\s+track|non-album[^)]*)\)/gi,
  /\s*\[(?:bonus\s+track|non-album[^\]]*)\]/gi,
  /\s*\(-\)/g,
];

function cleanTitle(title) {
  let t = title.replace(/\s*[-–—]\s*(?:Unshatter Film Soundtrack|BRO's Studio).*$/i, "");
  for (const pat of NOISE_PATTERNS) {
    t = t.replace(pat, "");
  }
  t = t.replace(/❤️/g, "").replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  return t.replace(/\s+/g, " ").trim();
}

async function main() {
  console.log("🚀 Starting Complete Catalogue Remediation...\n");

  await db.execute("PRAGMA journal_mode = WAL;");
  await db.execute("PRAGMA busy_timeout = 8000;");

  // 1. Title corrections (Bernadya, Sheila On 7, Tuan Tigabelas)
  console.log("1. Applying title fixes...");
  for (const [id, data] of Object.entries(TITLE_FIXES)) {
    const res = await db.execute({
      sql: "UPDATE songs SET title = ?, search_query = ? WHERE id = ?;",
      args: [data.title, data.searchQuery, id],
    });
    if (res.rowsAffected > 0) {
      console.log(`   ✓ ${id} -> "${data.title}"`);
    }
  }

  // 1b. Standardize artist name casing and punctuation inconsistencies
  console.log("\n1b. Standardizing artist casing & punctuation...");
  const ARTIST_STD = {
    "Ada Band": "ADA Band",
    "D'Masiv": "D’MASIV",
    "ELVY SUKAESIH": "Elvy Sukaesih",
    "GUYON WATON": "Guyon Waton",
    "NDX AKA": "NDX A.K.A",
    "NaFF": "Naff",
  };
  for (const [oldName, newName] of Object.entries(ARTIST_STD)) {
    const sRes = await db.execute({
      sql: "UPDATE songs SET artist = ?, search_query = title || ' ' || ? WHERE artist = ?;",
      args: [newName, newName, oldName],
    });
    const aRes = await db.execute({
      sql: "UPDATE song_artists SET artist_name = ? WHERE artist_name = ?;",
      args: [newName, oldName],
    });
    if (sRes.rowsAffected > 0) {
      console.log(`   ✓ Standardized artist "${oldName}" -> "${newName}" (${sRes.rowsAffected} songs)`);
    }
  }

  // 2. Lyrics and YouTube Backfill for Iconic Hits
  console.log("\n2. Backfilling lyrics and YouTube IDs for iconic hits...");
  for (const [id, data] of Object.entries(LYRICS_BACKFILL)) {
    const jsonLyrics = JSON.stringify(data.lyrics);
    if (data.youtube_id) {
      await db.execute({
        sql: `UPDATE songs 
              SET lyrics_clues = ?, youtube_id = ?, youtube_status = ?, youtube_start_second = ?, is_active = 1
              WHERE id = ?;`,
        args: [jsonLyrics, data.youtube_id, data.youtube_status, data.youtube_start_second, id],
      });
    } else {
      await db.execute({
        sql: `UPDATE songs SET lyrics_clues = ?, is_active = 1 WHERE id = ?;`,
        args: [jsonLyrics, id],
      });
    }
    console.log(`   ✓ Enriched ${id} with 4-stanza lyrics`);
  }

  // 3. Deactivate Phantom / Fake Tracks
  console.log("\n3. Deactivating phantom tracks...");
  for (const id of PHANTOM_TRACKS) {
    await db.execute({
      sql: "UPDATE songs SET is_active = 0 WHERE id = ?;",
      args: [id],
    });
    console.log(`   ✓ Deactivated phantom ${id}`);
  }

  // 4. Deactivate foreign search-collision tracks
  console.log("\n4. Deactivating foreign search collisions in Nostalgia 2000s & Galau Hits...");
  const nPh = NOSTALGIA_FOREIGN_ARTISTS.map(() => "?").join(",");
  const nRes = await db.execute({
    sql: `UPDATE songs SET is_active = 0 WHERE category = 'Nostalgia 2000s' AND artist IN (${nPh});`,
    args: NOSTALGIA_FOREIGN_ARTISTS,
  });
  console.log(`   ✓ Nostalgia 2000s foreign deactivated: ${nRes.rowsAffected} songs`);

  const gPh = GALAU_FOREIGN_ARTISTS.map(() => "?").join(",");
  const gRes = await db.execute({
    sql: `UPDATE songs SET is_active = 0 WHERE category = 'Galau Hits' AND artist IN (${gPh});`,
    args: GALAU_FOREIGN_ARTISTS,
  });
  console.log(`   ✓ Galau Hits foreign deactivated: ${gRes.rowsAffected} songs`);

  // 5. Clean metadata noise and deduplicate variants across ALL remaining active songs
  console.log("\n5. Cleaning metadata noise and deduplicating variants...");
  const allActiveRes = await db.execute(`
    SELECT id, title, artist, category, youtube_id, youtube_status, popularity, is_active
    FROM songs 
    WHERE is_active = 1 OR is_active IS NULL;
  `);

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
      // Score: prefer exact clean title, prefer ready youtube, prefer popularity
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
  console.log(`   ✓ Metadata noise stripped from titles: ${titlesCleaned}`);

  // 6. Refresh artists master table
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
    console.log(`   ✓ songs.json updated with ${snapshotSongs.length} songs.`);
  }

  // Summary counts
  const totalActive = await db.execute("SELECT COUNT(*) c FROM songs WHERE is_active = 1 OR is_active IS NULL;");
  const totalInactive = await db.execute("SELECT COUNT(*) c FROM songs WHERE is_active = 0;");
  console.log(`\n══════════════════════════════════════════════`);
  console.log(`📊 Complete Remediation Summary:`);
  console.log(`   Total Active Songs  : ${totalActive.rows[0].c}`);
  console.log(`   Total Deactivated   : ${totalInactive.rows[0].c}`);
  console.log(`══════════════════════════════════════════════\n`);
}

main().catch(console.error);
