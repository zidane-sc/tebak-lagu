const { createClient } = require("@libsql/client");
const path = require("path");
const fs = require("fs");

function getDbConfig() {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (e) {}
  }

  const defaultDbPath = `file:${path.join(dataDir, "tebak_lagu.db")}`;
  const url = process.env.DATABASE_URL || defaultDbPath;
  const authToken = process.env.DATABASE_AUTH_TOKEN;

  return { url, authToken };
}

const { url: dbUrl, authToken } = getDbConfig();

const db = createClient({
  url: dbUrl,
  authToken,
});

function rowToSong(row) {
  if (!row) return null;

  let lyricsClues = [];
  try {
    lyricsClues = typeof row.lyrics_clues === "string" ? JSON.parse(row.lyrics_clues) : row.lyrics_clues || [];
  } catch (e) {
    lyricsClues = [];
  }

  let hummingMelody = [];
  try {
    hummingMelody = typeof row.humming_melody === "string" ? JSON.parse(row.humming_melody) : row.humming_melody || [];
  } catch (e) {
    hummingMelody = [];
  }

  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    year: row.year,
    category: row.category,
    difficulty: row.difficulty,
    popularity: row.popularity || 50,
    deezerRank: row.deezer_rank || 0,
    bpm: row.bpm || 0,
    previewUrl: row.preview_url || "",
    previewResolved: row.preview_url || "",
    albumCover: row.album_cover || "",
    album: row.album || "",
    lyricsClues,
    hummingMelody,
    searchQuery: row.search_query || `${row.title} ${row.artist}`,
    startSecond: 0,
    lang: row.category === "Western Hits" ? "en" : "id",
    timesPlayed: row.times_played || 0,
    timesGuessed: row.times_guessed || 0,
    timesFailed: row.times_failed || 0,
  };
}

async function initDb() {
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

  // Ensure 'album' column exists
  try {
    await db.execute("ALTER TABLE songs ADD COLUMN album TEXT;");
  } catch (e) {
    // Column already exists
  }

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

  // Multi-Artist & Multi-Singer Architecture
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

  const countRes = await db.execute("SELECT COUNT(*) as total FROM songs;");
  const count = Number(countRes.rows[0]?.total || 0);

  if (count === 0) {
    console.log("> Database is empty! Auto-seeding 4,600+ verified songs from songs.json...");
    const jsonPath = path.join(process.cwd(), "src/data/songs.json");
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, "utf-8");
      const songs = JSON.parse(raw);

      const CHUNK_SIZE = 100;
      for (let i = 0; i < songs.length; i += CHUNK_SIZE) {
        const chunk = songs.slice(i, i + CHUNK_SIZE);
        const stmts = chunk.map((s) => ({
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
        await db.batch(stmts);
      }
      console.log(`> Successfully seeded ${songs.length} songs into persistent database!`);
    }
  }
}

async function getRandomSong(category, difficulty) {
  let sql = "SELECT * FROM songs WHERE 1=1";
  const args = [];

  if (category && category !== "all" && category !== "Semua Genre") {
    sql += " AND category = ?";
    args.push(category);
  }

  if (difficulty && difficulty !== "all") {
    sql += " AND difficulty = ?";
    args.push(difficulty);
  }

  sql += " ORDER BY RANDOM() LIMIT 1;";

  const res = await db.execute({ sql, args });
  if (res.rows.length === 0) {
    const fallback = await db.execute("SELECT * FROM songs ORDER BY RANDOM() LIMIT 1;");
    return rowToSong(fallback.rows[0]);
  }

  return rowToSong(res.rows[0]);
}

async function getCatalogStats() {
  const totalRes = await db.execute("SELECT COUNT(*) as total FROM songs;");
  const total = Number(totalRes.rows[0]?.total || 0);

  const diffRes = await db.execute("SELECT difficulty, COUNT(*) as count FROM songs GROUP BY difficulty;");
  const byDifficulty = { easy: 0, medium: 0, hard: 0 };
  for (const r of diffRes.rows) {
    byDifficulty[String(r.difficulty)] = Number(r.count);
  }

  const catRes = await db.execute("SELECT category, COUNT(*) as count FROM songs GROUP BY category;");
  const byCategory = {};
  for (const r of catRes.rows) {
    byCategory[String(r.category)] = Number(r.count);
  }

  return { total, byDifficulty, byCategory };
}

async function getMatchSongsQueue(category, difficulty, count = 5) {
  let sql = "SELECT * FROM songs WHERE 1=1";
  const args = [];

  if (category && category !== "all" && category !== "Semua Genre") {
    sql += " AND category = ?";
    args.push(category);
  }

  if (difficulty && difficulty !== "all") {
    sql += " AND difficulty = ?";
    args.push(difficulty);
  }

  // Fetch a larger sample pool to guarantee unique selections
  sql += " ORDER BY RANDOM() LIMIT ?;";
  args.push(Math.max(count * 3, 25));

  const res = await db.execute({ sql, args });
  const pool = res.rows.map(rowToSong);

  // Guarantee 100% distinct song IDs
  const uniqueSongs = [];
  const seenIds = new Set();
  for (const s of pool) {
    if (!seenIds.has(s.id)) {
      seenIds.add(s.id);
      uniqueSongs.push(s);
      if (uniqueSongs.length >= count) break;
    }
  }

  return uniqueSongs;
}

module.exports = {
  db,
  initDb,
  rowToSong,
  getRandomSong,
  getMatchSongsQueue,
  getCatalogStats,
};
