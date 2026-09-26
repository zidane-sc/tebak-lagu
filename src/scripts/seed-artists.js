const { createClient } = require("@libsql/client");
const path = require("path");
const fs = require("fs");
const { parseSongArtists, slugifyArtist } = require("../lib/artist-parser.js");

const DB_PATH =
  process.env.DATABASE_URL ||
  `file:${path.join(process.cwd(), "data/tebak_lagu.db")}`;

const db = createClient({ url: DB_PATH });

async function seedArtists() {
  console.log("=== Memulai Multi-Artist & Multi-Singer Seeding ===");
  console.log(`Database Target: ${DB_PATH}`);

  // 1. Create Schema
  await db.execute(`
    CREATE TABLE IF NOT EXISTS artists (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      image TEXT,
      category TEXT,
      song_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS song_artists (
      song_id TEXT NOT NULL,
      artist_id TEXT NOT NULL,
      artist_name TEXT NOT NULL,
      role TEXT DEFAULT 'primary',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (song_id, artist_id)
    );
  `);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_song_artists_artist ON song_artists(artist_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_song_artists_song ON song_artists(song_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_song_artists_name ON song_artists(artist_name);`);

  // Clear existing artist relations for clean sync
  await db.execute("DELETE FROM song_artists;");
  await db.execute("DELETE FROM artists;");

  // 2. Fetch all songs
  const songsRes = await db.execute("SELECT id, title, artist, category, album_cover, deezer_rank, search_query FROM songs;");
  const allSongs = songsRes.rows;
  console.log(`Ditemukan ${allSongs.length} lagu di database. Mulai mengekstrak penyanyi...`);

  // In-memory aggregates for artists
  // artistId -> { id, name, categoryCounts: {}, images: [], songIds: Set, topRank: 0 }
  const artistMap = new Map();
  const songArtistPairs = [];
  const searchUpdates = [];

  let collabCount = 0;

  for (const song of allSongs) {
    const rawArtist = String(song.artist || "").trim();
    const extracted = parseSongArtists(rawArtist);

    if (extracted.length > 1) {
      collabCount++;
    }

    const artistNamesInSong = [];

    for (const a of extracted) {
      artistNamesInSong.push(a.name);

      // Track artist meta
      if (!artistMap.has(a.id)) {
        artistMap.set(a.id, {
          id: a.id,
          name: a.name,
          categoryCounts: {},
          image: song.album_cover || "",
          topRank: Number(song.deezer_rank || 0),
          songIds: new Set(),
        });
      }

      const entry = artistMap.get(a.id);
      entry.songIds.add(song.id);

      // Category frequency
      const cat = String(song.category || "Pop");
      entry.categoryCounts[cat] = (entry.categoryCounts[cat] || 0) + 1;

      // Better image if this song has higher popularity/rank
      if (Number(song.deezer_rank || 0) >= entry.topRank && song.album_cover) {
        entry.image = song.album_cover;
        entry.topRank = Number(song.deezer_rank || 0);
      }

      songArtistPairs.push({
        song_id: song.id,
        artist_id: a.id,
        artist_name: a.name,
        role: a.role,
      });
    }

    // Enrich search_query in song if there are multi-artists
    const enrichedQuery = `${song.title} ${artistNamesInSong.join(" ")}`;
    if (enrichedQuery !== song.search_query) {
      searchUpdates.push({ id: song.id, query: enrichedQuery });
    }
  }

  console.log(`\nEkstraksi selesai:`);
  console.log(`- Total Lagu Terdeteksi Kolaborasi/Duet: ${collabCount} lagu`);
  console.log(`- Total Penyanyi Unik (Individual): ${artistMap.size} penyanyi`);
  console.log(`- Total Relasi Lagu-Penyanyi (song_artists): ${songArtistPairs.length} relasi`);

  // 3. Batch Insert into `artists`
  console.log(`\nMenyimpan ${artistMap.size} penyanyi ke tabel artists...`);
  const artistList = Array.from(artistMap.values());
  const BATCH_SIZE = 100;

  for (let i = 0; i < artistList.length; i += BATCH_SIZE) {
    const chunk = artistList.slice(i, i + BATCH_SIZE);
    const stmts = chunk.map((a) => {
      // Find top category
      let topCat = "Galau Hits";
      let maxC = 0;
      for (const [c, cnt] of Object.entries(a.categoryCounts)) {
        if (cnt > maxC) {
          maxC = cnt;
          topCat = c;
        }
      }

      return {
        sql: `
          INSERT OR REPLACE INTO artists (id, name, image, category, song_count)
          VALUES (?, ?, ?, ?, ?);
        `,
        args: [a.id, a.name, a.image, topCat, a.songIds.size],
      };
    });

    await db.batch(stmts);
  }

  // 4. Batch Insert into `song_artists`
  console.log(`Menyimpan ${songArtistPairs.length} relasi ke tabel song_artists...`);
  for (let i = 0; i < songArtistPairs.length; i += BATCH_SIZE) {
    const chunk = songArtistPairs.slice(i, i + BATCH_SIZE);
    const stmts = chunk.map((sa) => ({
      sql: `
        INSERT OR REPLACE INTO song_artists (song_id, artist_id, artist_name, role)
        VALUES (?, ?, ?, ?);
      `,
      args: [sa.song_id, sa.artist_id, sa.artist_name, sa.role],
    }));

    await db.batch(stmts);
  }

  // 5. Update search queries for fast autocomplete matching
  if (searchUpdates.length > 0) {
    console.log(`Memperbarui ${searchUpdates.length} kata kunci search_query lagu...`);
    for (let i = 0; i < searchUpdates.length; i += BATCH_SIZE) {
      const chunk = searchUpdates.slice(i, i + BATCH_SIZE);
      const stmts = chunk.map((su) => ({
        sql: "UPDATE songs SET search_query = ? WHERE id = ?;",
        args: [su.query, su.id],
      }));
      await db.batch(stmts);
    }
  }

  // 6. Print Top 10 Artists
  const topArtists = artistList
    .sort((a, b) => b.songIds.size - a.songIds.size)
    .slice(0, 10);

  console.log("\n=== 10 PENYANYI DENGAN REKOR LAGU TERBANYAK ===");
  topArtists.forEach((a, idx) => {
    console.log(`${idx + 1}. ${a.name} -> ${a.songIds.size} Lagu`);
  });

  console.log("\n✓ Seeding Penyanyi & Relasi Multi-Artis Selesai Sukses 100%!");
}

if (require.main === module) {
  seedArtists()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Fatal error seeding artists:", err);
      process.exit(1);
    });
}

module.exports = { seedArtists };
