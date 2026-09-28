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
    startSecond: row.start_second !== undefined && row.start_second !== null ? Number(row.start_second) : 0,
    lang: row.category === "Western Hits" ? "en" : "id",
    timesPlayed: row.times_played || 0,
    timesGuessed: row.times_guessed || 0,
    timesFailed: row.times_failed || 0,
    isActive: row.is_active !== undefined && row.is_active !== null ? Number(row.is_active) === 1 : true,
    // YouTube fields
    youtubeId: row.youtube_id || null,
    youtubeStartSecond: row.youtube_start_second !== undefined && row.youtube_start_second !== null ? Number(row.youtube_start_second) : 20,
    youtubeStatus: row.youtube_status || "pending",
    hasYoutube: !!(row.youtube_id && row.youtube_status === "ready"),
  };
}

async function initDb() {
  // 0. WAL Mode & Concurrency Pragmas
  try {
    await db.execute("PRAGMA journal_mode = WAL;");
    await db.execute("PRAGMA busy_timeout = 5000;");
    await db.execute("PRAGMA synchronous = NORMAL;");
  } catch (e) {
    // Ignore pragma errors
  }

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

  // Ensure 'album' and 'start_second' columns exist
  try {
    await db.execute("ALTER TABLE songs ADD COLUMN album TEXT;");
  } catch (e) {
    // Column already exists
  }

  try {
    await db.execute("ALTER TABLE songs ADD COLUMN start_second INTEGER DEFAULT 0;");
  } catch (e) {
    // Column already exists
  }

  try {
    await db.execute("ALTER TABLE songs ADD COLUMN is_active INTEGER DEFAULT 1;");
  } catch (e) {
    // Column already exists
  }

  try {
    await db.execute("ALTER TABLE artists ADD COLUMN is_active INTEGER DEFAULT 1;");
  } catch (e) {
    // Column already exists
  }

  // Soft delete for users
  try {
    await db.execute("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1;");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE users ADD COLUMN deleted_at DATETIME DEFAULT NULL;");
  } catch (e) {}

  // FTS5 Virtual Table & Auto-Sync Triggers
  try {
    await db.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts USING fts5(
        id UNINDEXED,
        title,
        artist,
        search_query,
        tokenize = 'unicode61 remove_diacritics 2'
      );
    `);

    const ftsCountRes = await db.execute("SELECT COUNT(*) as c FROM songs_fts;");
    if (Number(ftsCountRes.rows[0]?.c || 0) === 0) {
      await db.execute(`
        INSERT INTO songs_fts(id, title, artist, search_query)
        SELECT id, title, artist, COALESCE(search_query, title || ' ' || artist) FROM songs;
      `);
    }

    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS songs_ai AFTER INSERT ON songs BEGIN
        INSERT INTO songs_fts(id, title, artist, search_query)
        VALUES (new.id, new.title, new.artist, COALESCE(new.search_query, new.title || ' ' || new.artist));
      END;
    `);

    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS songs_ad AFTER DELETE ON songs BEGIN
        DELETE FROM songs_fts WHERE id = old.id;
      END;
    `);

    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS songs_au AFTER UPDATE ON songs BEGIN
        DELETE FROM songs_fts WHERE id = old.id;
        INSERT INTO songs_fts(id, title, artist, search_query)
        VALUES (new.id, new.title, new.artist, COALESCE(new.search_query, new.title || ' ' || new.artist));
      END;
    `);
  } catch (e) {
    // FTS5 already configured
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

// Query random song matching category, difficulty, artists, and mode
async function getRandomSong(category, difficulty, mode = null, artists = null) {
  let sql = "SELECT s.* FROM songs s WHERE (s.is_active = 1 OR s.is_active IS NULL)";
  const args = [];

  // Exclude disabled artists
  sql += " AND s.id NOT IN (SELECT sa.song_id FROM song_artists sa JOIN artists a ON sa.artist_id = a.id WHERE a.is_active = 0)";

  // If specific artists selected
  if (artists) {
    const artistList = Array.isArray(artists)
      ? artists
      : String(artists).split(",").map((a) => a.trim()).filter(Boolean);
    if (artistList.length > 0) {
      const placeholders = artistList.map(() => "?").join(",");
      sql += ` AND s.id IN (
        SELECT sa.song_id FROM song_artists sa 
        JOIN artists a ON sa.artist_id = a.id 
        WHERE a.id IN (${placeholders}) OR a.name IN (${placeholders})
      )`;
      args.push(...artistList, ...artistList);
    }
  } else if (category && category !== "all" && category !== "Semua Genre") {
    sql += " AND s.category = ?";
    args.push(category);
  }

  if (difficulty && difficulty !== "all") {
    sql += " AND s.difficulty = ?";
    args.push(difficulty);
  }

  if (mode === "heardle") {
    sql += " AND s.youtube_status = 'ready' AND s.youtube_id IS NOT NULL";
  } else if (mode === "tts") {
    sql += " AND s.lyrics_clues IS NOT NULL AND json_array_length(s.lyrics_clues) >= 4";
  }

  sql += " ORDER BY RANDOM() LIMIT 1;";

  const res = await db.execute({ sql, args });
  if (res.rows.length === 0) {
    // Drop ONLY the mode requirement, keep playlist/difficulty/artist filters
    const relaxed = await db.execute({
      sql: sql
        .replace(
          " AND s.lyrics_clues IS NOT NULL AND json_array_length(s.lyrics_clues) >= 4",
          ""
        )
        .replace(
          " AND s.youtube_status = 'ready' AND s.youtube_id IS NOT NULL",
          ""
        ),
      args,
    });
    if (relaxed.rows.length > 0) {
      return rowToSong(relaxed.rows[0]);
    }
    const fallback = await db.execute(
      "SELECT * FROM songs WHERE (is_active = 1 OR is_active IS NULL) ORDER BY RANDOM() LIMIT 1;"
    );
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

async function getMatchSongsQueue(category, difficulty, count = 5, mode = null, artists = null) {
  let sql = "SELECT s.* FROM songs s WHERE (s.is_active = 1 OR s.is_active IS NULL)";
  const args = [];

  // Exclude disabled artists
  sql += " AND s.id NOT IN (SELECT sa.song_id FROM song_artists sa JOIN artists a ON sa.artist_id = a.id WHERE a.is_active = 0)";

  if (artists) {
    const artistList = Array.isArray(artists)
      ? artists
      : String(artists).split(",").map((a) => a.trim()).filter(Boolean);
    if (artistList.length > 0) {
      const placeholders = artistList.map(() => "?").join(",");
      sql += ` AND s.id IN (
        SELECT sa.song_id FROM song_artists sa 
        JOIN artists a ON sa.artist_id = a.id 
        WHERE a.id IN (${placeholders}) OR a.name IN (${placeholders})
      )`;
      args.push(...artistList, ...artistList);
    }
  } else if (category && category !== "all" && category !== "Semua Genre") {
    sql += " AND s.category = ?";
    args.push(category);
  }

  if (difficulty && difficulty !== "all") {
    sql += " AND s.difficulty = ?";
    args.push(difficulty);
  }

  if (mode === "heardle") {
    sql += " AND s.youtube_status = 'ready' AND s.youtube_id IS NOT NULL";
  } else if (mode === "tts") {
    sql += " AND s.lyrics_clues IS NOT NULL AND json_array_length(s.lyrics_clues) >= 4";
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
    if (s && !seenIds.has(s.id)) {
      seenIds.add(s.id);
      uniqueSongs.push(s);
      if (uniqueSongs.length >= count) break;
    }
  }

  return uniqueSongs;
}

const DEFAULT_SETTINGS = {
  buzzerTimerSeconds: 15,
  playerLivesPerRound: 3,
  clueExtensionIntervalSeconds: 10,
  finalStageSeconds: 15,
  disconnectGracePeriodSeconds: 45,
  defaultRounds: 5,
  defaultDifficulty: "easy",
  defaultAudioProfile: "normal",
  heardleDurations: [5, 9, 18, 30],
  ttsCluesProgression: [1, 2, 3, 4],
};

async function getSettingsFromDb() {
  try {
    const res = await db.execute("SELECT key, value FROM app_settings;");
    const settings = { ...DEFAULT_SETTINGS };
    for (const r of res.rows) {
      try {
        settings[String(r.key)] = JSON.parse(String(r.value));
      } catch {
        settings[String(r.key)] = r.value;
      }
    }
    return settings;
  } catch (err) {
    console.error("Error reading settings from DB:", err);
    return DEFAULT_SETTINGS;
  }
}

module.exports = {
  db,
  initDb,
  rowToSong,
  getRandomSong,
  getMatchSongsQueue,
  getCatalogStats,
  getSettingsFromDb,
  DEFAULT_SETTINGS,
};
