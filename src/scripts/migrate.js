const { createClient } = require("@libsql/client");
const path = require("path");
const fs = require("fs");

async function migrate() {
  console.log("=== Starting Database Migration to LibSQL / SQLite ===");

  const dataDir = path.join(__dirname, "../../data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "tebak_lagu.db");
  const dbUrl = process.env.DATABASE_URL || `file:${dbPath}`;
  console.log(`Connecting to database at: ${dbUrl}`);

  const db = createClient({
    url: dbUrl,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  // 1. Initialize Tables
  console.log("1. Creating tables and indexes...");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      year INTEGER,
      category TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      popularity INTEGER DEFAULT 50,
      deezer_rank INTEGER DEFAULT 0,
      bpm REAL DEFAULT 0,
      preview_url TEXT,
      album_cover TEXT,
      lyrics_clues TEXT,
      humming_melody TEXT,
      search_query TEXT,
      times_played INTEGER DEFAULT 0,
      times_guessed INTEGER DEFAULT 0,
      times_failed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_songs_category ON songs(category);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_songs_difficulty ON songs(difficulty);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT,
      total_score INTEGER DEFAULT 0,
      games_played INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      player_name TEXT NOT NULL,
      player_avatar TEXT,
      mode TEXT NOT NULL,
      category TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      score INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_leaderboard_mode ON leaderboard(mode);`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // 2. Read songs.json
  const jsonPath = path.join(__dirname, "../data/songs.json");
  console.log(`2. Reading songs from: ${jsonPath}`);
  const songs = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`Found ${songs.length} songs in JSON.`);

  // 3. Batch insert in chunks of 100
  console.log("3. Inserting songs in batches...");
  const CHUNK_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < songs.length; i += CHUNK_SIZE) {
    const chunk = songs.slice(i, i + CHUNK_SIZE);
    const statements = chunk.map((s) => ({
      sql: `
        INSERT OR REPLACE INTO songs (
          id, title, artist, year, category, difficulty, popularity,
          deezer_rank, bpm, preview_url, album_cover, lyrics_clues,
          humming_melody, search_query
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      args: [
        s.id,
        s.title || "Untitled",
        s.artist || "Unknown",
        s.year || 2020,
        s.category || "Galau Hits",
        s.difficulty || "easy",
        s.popularity || 50,
        s.deezerRank || 0,
        s.bpm || 0,
        s.previewUrl || s.previewResolved || "",
        s.albumCover || "",
        JSON.stringify(s.lyricsClues || []),
        JSON.stringify(s.hummingMelody || []),
        s.searchQuery || `${s.title} ${s.artist}`,
      ],
    }));

    await db.batch(statements);
    inserted += chunk.length;
    process.stdout.write(`\rInserted ${inserted}/${songs.length} songs...`);
  }

  console.log("\n4. Verifying database records...");
  const countRes = await db.execute("SELECT COUNT(*) as total FROM songs;");
  const totalInDb = countRes.rows[0].total;
  console.log(`✓ Total songs in database: ${totalInDb}`);

  const sampleRes = await db.execute("SELECT id, title, artist, category, difficulty FROM songs LIMIT 3;");
  console.log("Sample songs:", sampleRes.rows);

  console.log("\n=== Migration Successfully Completed! ===");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
