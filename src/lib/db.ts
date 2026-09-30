import { createClient, Client } from "@libsql/client";
import path from "path";
import fs from "fs";
// CommonJS module so the socket engine in server.js restores identically.
// The inline copy this replaces had drifted: it gained the enrichment columns
// while the duplicate in db-server.js kept seeding only the original 14.
import { restoreCatalogueIfEmpty } from "./catalogue-restore";

// Determine DB URL:
// In Docker / Fly.io: /app/data/tebak_lagu.db
// In local dev: ./data/tebak_lagu.db
// Or remote Turso: libsql://...
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

export const db: Client = createClient({
  url: dbUrl,
  authToken,
});

// Helper: Convert SQLite row to Song object
export function rowToSong(row: any) {
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
    // YouTube Engine metadata
    youtubeId: row.youtube_id || null,
    youtubeStartSecond: row.youtube_start_second !== undefined && row.youtube_start_second !== null ? Number(row.youtube_start_second) : 20,
    youtubeStatus: row.youtube_status || "pending",
    hasYoutube: !!(row.youtube_id && row.youtube_status === "ready"),
  };
}

// Initialize Schema and Auto-Seed if empty
export async function initDb() {
  // 0. WAL Mode & Concurrency Pragmas
  try {
    await db.execute("PRAGMA journal_mode = WAL;");
    await db.execute("PRAGMA busy_timeout = 5000;");
    await db.execute("PRAGMA synchronous = NORMAL;");
  } catch (e) {
    // Ignore pragma errors on edge drivers
  }

  // 1. Create Tables
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
      album TEXT,
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

  // Soft Delete columns for users
  try {
    await db.execute("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1;");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE users ADD COLUMN deleted_at DATETIME DEFAULT NULL;");
  } catch (e) {}

  // FTS5 Virtual Table & Auto-Sync Triggers for sub-millisecond search
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
    // FTS5 already configured or edge error
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

  // Player sessions. The cookie carries a signed id; this table is what makes it
  // revocable — a cookie alone cannot be withdrawn, and a leaked one would stay
  // valid for as long as its signature checks out.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS player_sessions (
      session_id TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      user_agent TEXT
    );
  `);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_player_sessions_user ON player_sessions(user_id);`
  );

  // Profile fields. Added with ALTER rather than in the CREATE TABLE because the
  // column only exists here; CREATE TABLE IF NOT EXISTS is a no-op on a database
  // created before this shipped, so the new columns would never appear.
  for (const col of [
    "ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN favorite_artist TEXT DEFAULT ''",
  ]) {
    try {
      await db.execute(col);
    } catch {
      // "duplicate column name" — already there, which is the normal case.
    }
  }

  // 2. Check if songs table is empty -> Auto-seed from songs.json
  const countRes = await db.execute("SELECT COUNT(*) as total FROM songs;");
  const count = Number(countRes.rows[0]?.total || 0);

  if (count === 0) {
    // Restore lives in catalogue-restore.js: this inline copy was widened to
    // carry the enrichment columns while the duplicate in db-server.js kept
    // seeding only the original 14, so a socket-engine restore dropped every
    // YouTube id.
    await restoreCatalogueIfEmpty(db);
  }
}

// Query random song matching category, difficulty, artists, and mode
export async function getRandomSong(
  category?: string | null,
  difficulty?: string | null,
  artists?: string[] | string | null,
  mode?: string | null,
  excludeIds?: string[]
) {
  let sql = "SELECT s.* FROM songs s WHERE (s.is_active = 1 OR s.is_active IS NULL)";
  const args: any[] = [];

  // Exclude disabled artists
  sql += " AND s.id NOT IN (SELECT sa.song_id FROM song_artists sa JOIN artists a ON sa.artist_id = a.id WHERE a.is_active = 0)";

  // Exclude already-played songs in this session
  if (excludeIds && excludeIds.length > 0) {
    const ph = excludeIds.map(() => "?").join(",");
    sql += ` AND s.id NOT IN (${ph})`;
    args.push(...excludeIds);
  }

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

  // Difficulty is cumulative: easy ⊂ medium ⊂ hard. Picking "hard" means the
  // whole catalogue, not only deep cuts.
  if (difficulty === "easy") {
    sql += " AND s.difficulty = 'easy'";
  } else if (difficulty === "medium") {
    sql += " AND s.difficulty IN ('easy', 'medium')";
  }
  // "hard" and "all" add no constraint — hard is the full pool.

  if (mode === "heardle") {
    sql += " AND s.youtube_status = 'ready' AND s.youtube_id IS NOT NULL";
  } else if (mode === "tts") {
    sql += " AND s.lyrics_clues IS NOT NULL AND json_array_length(s.lyrics_clues) >= 4";
  }

  sql += " ORDER BY RANDOM() LIMIT 1;";

  const res = await db.execute({ sql, args });
  if (res.rows.length === 0) {
    // No song satisfies the full filter set (e.g. artist picked but none of
    // their songs are YouTube-ready yet). Retry while dropping ONLY the mode
    // requirement, keeping playlist/difficulty/artist filters intact so the
    // player never silently gets a song from a different artist.
    const relaxed = await db.execute({
      sql: sql.replace(
        " AND s.lyrics_clues IS NOT NULL AND json_array_length(s.lyrics_clues) >= 4",
        ""
      ).replace(
        " AND s.youtube_status = 'ready' AND s.youtube_id IS NOT NULL",
        ""
      ),
      args,
    });
    if (relaxed.rows.length > 0) {
      return rowToSong(relaxed.rows[0]);
    }

    // Absolute last resort: any active song at all.
    const fallback = await db.execute(
      "SELECT * FROM songs WHERE (is_active = 1 OR is_active IS NULL) ORDER BY RANDOM() LIMIT 1;"
    );
    return rowToSong(fallback.rows[0]);
  }

  return rowToSong(res.rows[0]);
}

// Pre-roll a queue of distinct songs for a match
export async function getMatchSongsQueue(
  category?: string | null,
  difficulty?: string | null,
  count: number = 5,
  mode?: string | null,
  artists?: string[] | string | null
) {
  let sql = "SELECT s.* FROM songs s WHERE (s.is_active = 1 OR s.is_active IS NULL)";
  const args: any[] = [];

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

  // Difficulty is cumulative: easy ⊂ medium ⊂ hard. Picking "hard" means the
  // whole catalogue, not only deep cuts.
  if (difficulty === "easy") {
    sql += " AND s.difficulty = 'easy'";
  } else if (difficulty === "medium") {
    sql += " AND s.difficulty IN ('easy', 'medium')";
  }
  // "hard" and "all" add no constraint — hard is the full pool.

  if (mode === "heardle") {
    sql += " AND s.youtube_status = 'ready' AND s.youtube_id IS NOT NULL";
  } else if (mode === "tts") {
    sql += " AND s.lyrics_clues IS NOT NULL AND json_array_length(s.lyrics_clues) >= 4";
  }

  sql += " ORDER BY RANDOM() LIMIT ?;";
  args.push(Math.max(count * 3, 25));

  const res = await db.execute({ sql, args });
  const pool = res.rows.map(rowToSong);

  const uniqueSongs: any[] = [];
  const seenIds = new Set<string>();
  for (const s of pool) {
    if (s && !seenIds.has(s.id)) {
      seenIds.add(s.id);
      uniqueSongs.push(s);
      if (uniqueSongs.length >= count) break;
    }
  }

  return uniqueSongs;
}

// Compute catalog stats
export async function getCatalogStats() {
  const totalRes = await db.execute("SELECT COUNT(*) as total FROM songs;");
  const total = Number(totalRes.rows[0]?.total || 0);

  const diffRes = await db.execute(`
    SELECT difficulty, COUNT(*) as count FROM songs GROUP BY difficulty;
  `);
  const byDifficulty: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  for (const r of diffRes.rows) {
    byDifficulty[String(r.difficulty)] = Number(r.count);
  }

  const catRes = await db.execute(`
    SELECT category, COUNT(*) as count FROM songs GROUP BY category;
  `);
  const byCategory: Record<string, number> = {};
  for (const r of catRes.rows) {
    byCategory[String(r.category)] = Number(r.count);
  }

  return {
    total,
    easy: byDifficulty.easy || 0,
    medium: byDifficulty.medium || 0,
    hard: byDifficulty.hard || 0,
    byCategory,
  };
}

// Paginated Search for Admin & API
export async function getSongsPaged(options: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  difficulty?: string;
}) {
  const page = Math.max(1, options.page || 1);
  const limit = Math.max(5, Math.min(100, options.limit || 25));
  const offset = (page - 1) * limit;

  let whereSql = " WHERE 1=1";
  const args: any[] = [];

  if (options.category && options.category !== "all" && options.category !== "Semua Genre") {
    whereSql += " AND category = ?";
    args.push(options.category);
  }

  if (options.difficulty && options.difficulty !== "all") {
    whereSql += " AND difficulty = ?";
    args.push(options.difficulty);
  }

  if (options.search && options.search.trim()) {
    whereSql += " AND (title LIKE ? OR artist LIKE ?)";
    const term = `%${options.search.trim()}%`;
    args.push(term, term);
  }

  // Count total filtered
  const countSql = `SELECT COUNT(*) as filteredTotal FROM songs${whereSql};`;
  const countRes = await db.execute({ sql: countSql, args });
  const filteredTotal = Number(countRes.rows[0]?.filteredTotal || 0);

  // Fetch page
  const dataSql = `SELECT * FROM songs${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?;`;
  const dataRes = await db.execute({ sql: dataSql, args: [...args, limit, offset] });

  const totalPages = Math.ceil(filteredTotal / limit) || 1;
  const songs = dataRes.rows.map(rowToSong);
  const stats = await getCatalogStats();

  return {
    total: stats.total,
    filteredTotal,
    page,
    limit,
    totalPages,
    stats,
    songs,
  };
}

// App Settings in DB
export async function getSettingsFromDb() {
  const res = await db.execute("SELECT key, value FROM app_settings;");
  const settings: Record<string, any> = {};
  for (const r of res.rows) {
    try {
      settings[String(r.key)] = JSON.parse(String(r.value));
    } catch {
      settings[String(r.key)] = r.value;
    }
  }
  return settings;
}

export async function saveSettingToDb(key: string, value: any) {
  const valStr = JSON.stringify(value);
  await db.execute({
    sql: "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?);",
    args: [key, valStr],
  });
}

// User Auth & Profiles in DB
export interface DbUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
  bio: string;
  favorite_artist: string;
  total_score: number;
  games_played: number;
  wins: number;
  isActive?: boolean;
  deletedAt?: string | null;
  created_at?: string;
  updated_at?: string;
}

export function rowToUser(row: any): DbUser | null {
  if (!row) return null;
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    avatar: row.avatar || "",
    bio: row.bio || "",
    favorite_artist: row.favorite_artist || "",
    total_score: Number(row.total_score || 0),
    games_played: Number(row.games_played || 0),
    wins: Number(row.wins || 0),
    isActive: row.is_active !== undefined && row.is_active !== null ? Number(row.is_active) === 1 : true,
    deletedAt: row.deleted_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function upsertGoogleUser(user: {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}): Promise<DbUser> {
  const emailClean = user.email.toLowerCase().trim();
  const check = await db.execute({
    sql: "SELECT * FROM users WHERE email = ?;",
    args: [emailClean],
  });

  if (check.rows.length > 0) {
    const existing = rowToUser(check.rows[0])!;
    await db.execute({
      sql: `UPDATE users SET name = ?, avatar = ?, is_active = 1, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      args: [user.name, user.avatar || existing.avatar, existing.id],
    });
    const refreshed = await db.execute({
      sql: "SELECT * FROM users WHERE id = ?;",
      args: [existing.id],
    });
    return rowToUser(refreshed.rows[0])!;
  }

  await db.execute({
    sql: `
      INSERT INTO users (id, email, name, avatar, total_score, games_played, wins, is_active)
      VALUES (?, ?, ?, ?, 0, 0, 0, 1);
    `,
    args: [user.id, emailClean, user.name, user.avatar || ""],
  });

  const created = await db.execute({
    sql: "SELECT * FROM users WHERE id = ?;",
    args: [user.id],
  });
  return rowToUser(created.rows[0])!;
}

export async function getUserById(userId: string): Promise<DbUser | null> {
  const res = await db.execute({
    sql: "SELECT * FROM users WHERE id = ? AND (is_active = 1 OR is_active IS NULL);",
    args: [userId],
  });
  if (res.rows.length === 0) return null;
  return rowToUser(res.rows[0]);
}

export async function softDeleteUser(userId: string): Promise<boolean> {
  const res = await db.execute({
    sql: "UPDATE users SET is_active = 0, deleted_at = CURRENT_TIMESTAMP WHERE id = ?;",
    args: [userId],
  });
  return (res.rowsAffected || 0) > 0;
}

export async function updateUserStats(
  userId: string,
  pointsGained: number,
  isWin: boolean = false
): Promise<DbUser | null> {
  await db.execute({
    sql: `
      UPDATE users SET
        total_score = total_score + ?,
        games_played = games_played + 1,
        wins = wins + ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?;
    `,
    args: [Math.max(0, pointsGained), isWin ? 1 : 0, userId],
  });

  return getUserById(userId);
}

// -------------------------------------------------------------
// PROFILE
// -------------------------------------------------------------

/**
 * Update the fields a player owns. Email and id are not editable: the account is
 * the Google identity, and letting either change would break the link between a
 * score and the account that earned it.
 */
export async function updateUserProfile(
  userId: string,
  fields: { name?: string; bio?: string; favoriteArtist?: string }
): Promise<DbUser | null> {
  const sets: string[] = [];
  const args: any[] = [];
  if (fields.name !== undefined) {
    sets.push("name = ?");
    args.push(fields.name);
  }
  if (fields.bio !== undefined) {
    sets.push("bio = ?");
    args.push(fields.bio);
  }
  if (fields.favoriteArtist !== undefined) {
    sets.push("favorite_artist = ?");
    args.push(fields.favoriteArtist);
  }
  if (sets.length === 0) return getUserById(userId);

  sets.push("updated_at = CURRENT_TIMESTAMP");
  args.push(userId);
  await db.execute({
    sql: `UPDATE users SET ${sets.join(", ")} WHERE id = ? AND is_active = 1;`,
    args,
  });
  return getUserById(userId);
}

// -------------------------------------------------------------
// PLAYER SESSIONS
// -------------------------------------------------------------

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function createPlayerSession(
  sessionId: string,
  userId: string,
  userAgent?: string
): Promise<void> {
  const expires = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await db.execute({
    sql: `INSERT OR REPLACE INTO player_sessions (session_id, user_id, expires_at, user_agent)
          VALUES (?, ?, ?, ?);`,
    args: [sessionId, userId, expires, userAgent || null],
  });
  await prunePlayerSessions();
}

/** The user a session belongs to, or null when it is unknown or expired. */
export async function resolvePlayerSession(sessionId: string): Promise<string | null> {
  const res = await db.execute({
    sql: `SELECT user_id FROM player_sessions
          WHERE session_id = ? AND expires_at > ?;`,
    args: [sessionId, new Date().toISOString()],
  });
  return res.rows.length ? String(res.rows[0].user_id) : null;
}

export async function deletePlayerSession(sessionId: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM player_sessions WHERE session_id = ?;", args: [sessionId] });
}

/** Drop expired rows. Without this the table grows without bound. */
async function prunePlayerSessions(): Promise<void> {
  await db.execute({
    sql: "DELETE FROM player_sessions WHERE expires_at <= ?;",
    args: [new Date().toISOString()],
  });
}

// -------------------------------------------------------------
// LEADERBOARD ENGINE
// -------------------------------------------------------------
export async function submitLeaderboardScore(entry: {
  user_id?: string;
  player_name: string;
  player_avatar?: string;
  mode: string;
  category: string;
  difficulty: string;
  score: number;
}) {
  const id = `lb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await db.execute({
    sql: `
      INSERT INTO leaderboard (id, user_id, player_name, player_avatar, mode, category, difficulty, score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `,
    args: [
      id,
      entry.user_id || null,
      (entry.player_name || "Raja Musik").trim(),
      entry.player_avatar || "",
      entry.mode || "heardle",
      entry.category || "Semua Genre",
      entry.difficulty || "easy",
      Math.max(0, entry.score || 0),
    ],
  });

  if (entry.user_id && entry.score > 0) {
    await updateUserStats(entry.user_id, entry.score, true);
  }

  return { id };
}

export async function getLeaderboard(options: {
  tab?: "all_time" | "weekly";
  mode?: string;
  limit?: number;
}) {
  const tab = options.tab || "all_time";
  const limit = Math.max(10, Math.min(100, options.limit || 50));
  const mode = options.mode && options.mode !== "all" ? options.mode : null;

  if (tab === "weekly") {
    let sql = `
      SELECT 
        COALESCE(user_id, player_name) as player_key,
        player_name,
        player_avatar,
        SUM(score) as total_score,
        COUNT(*) as games_count,
        MAX(created_at) as last_played
      FROM leaderboard
      WHERE created_at >= datetime('now', '-7 days')
    `;
    const args: any[] = [];
    if (mode) {
      sql += ` AND mode = ?`;
      args.push(mode);
    }
    sql += `
      GROUP BY player_key
      ORDER BY total_score DESC
      LIMIT ?;
    `;
    args.push(limit);

    const res = await db.execute({ sql, args });
    return res.rows.map((r: any, idx: number) => ({
      rank: idx + 1,
      player_key: r.player_key,
      player_name: r.player_name,
      player_avatar: r.player_avatar,
      score: Number(r.total_score || 0),
      games_count: Number(r.games_count || 0),
      last_played: r.last_played,
    }));
  } else {
    // All-time Mode-Specific:
    if (mode) {
      const sql = `
        SELECT 
          COALESCE(user_id, player_name) as player_key,
          player_name,
          player_avatar,
          SUM(score) as total_score,
          COUNT(*) as games_count,
          MAX(created_at) as last_played
        FROM leaderboard
        WHERE mode = ?
        GROUP BY player_key
        ORDER BY total_score DESC
        LIMIT ?;
      `;
      const res = await db.execute({ sql, args: [mode, limit] });
      return res.rows.map((r: any, idx: number) => ({
        rank: idx + 1,
        player_key: r.player_key,
        player_name: r.player_name,
        player_avatar: r.player_avatar,
        score: Number(r.total_score || 0),
        games_count: Number(r.games_count || 0),
        last_played: r.last_played,
      }));
    } else {
      // Overall All-time:
      const userRes = await db.execute({
        sql: `
          SELECT id as player_key, name as player_name, avatar as player_avatar, total_score, games_played, wins, updated_at as last_played
          FROM users
          WHERE total_score > 0 AND (is_active = 1 OR is_active IS NULL)
          ORDER BY total_score DESC
          LIMIT ?;
        `,
        args: [limit],
      });

      const usersList = userRes.rows.map((r: any) => ({
        player_key: r.player_key,
        player_name: r.player_name,
        player_avatar: r.player_avatar,
        score: Number(r.total_score || 0),
        games_count: Number(r.games_played || 0),
        wins: Number(r.wins || 0),
        last_played: r.last_played,
      }));

      const lbRes = await db.execute({
        sql: `
          SELECT 
            player_name as player_key,
            player_name,
            player_avatar,
            SUM(score) as total_score,
            COUNT(*) as games_count,
            MAX(created_at) as last_played
          FROM leaderboard
          WHERE user_id IS NULL
          GROUP BY player_name
          ORDER BY total_score DESC
          LIMIT ?;
        `,
        args: [limit],
      });

      const guestList = lbRes.rows.map((r: any) => ({
        player_key: r.player_key,
        player_name: r.player_name,
        player_avatar: r.player_avatar,
        score: Number(r.total_score || 0),
        games_count: Number(r.games_count || 0),
        wins: 0,
        last_played: r.last_played,
      }));

      const combined = [...usersList, ...guestList]
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((item, idx) => ({
          rank: idx + 1,
          ...item,
        }));

      return combined;
    }
  }
}

// -------------------------------------------------------------
// GAMEPLAY ANALYTICS & TRACKING ENGINE
// -------------------------------------------------------------
export async function recordSongPlay(songId: string) {
  if (!songId) return;
  try {
    await db.execute({
      sql: "UPDATE songs SET times_played = times_played + 1 WHERE id = ?;",
      args: [songId],
    });
  } catch (e) {
    console.error("Error recording song play:", e);
  }
}

export async function recordSongResult(songId: string, isCorrect: boolean) {
  if (!songId) return;
  try {
    if (isCorrect) {
      await db.execute({
        sql: "UPDATE songs SET times_guessed = times_guessed + 1 WHERE id = ?;",
        args: [songId],
      });
    } else {
      await db.execute({
        sql: "UPDATE songs SET times_failed = times_failed + 1 WHERE id = ?;",
        args: [songId],
      });
    }
  } catch (e) {
    console.error("Error recording song result:", e);
  }
}

export async function getAnalyticsData() {
  // 1. Overall Song Performance Metrics
  const songsStatsRes = await db.execute(`
    SELECT 
      COUNT(*) as total_catalog,
      SUM(times_played) as total_plays,
      SUM(times_guessed) as total_guesses,
      SUM(times_failed) as total_fails
    FROM songs;
  `);
  const totalCatalog = Number(songsStatsRes.rows[0]?.total_catalog || 0);
  const totalPlays = Number(songsStatsRes.rows[0]?.total_plays || 0);
  const totalGuesses = Number(songsStatsRes.rows[0]?.total_guesses || 0);
  const totalFails = Number(songsStatsRes.rows[0]?.total_fails || 0);
  const globalAccuracy = totalPlays > 0 ? Math.round((totalGuesses / totalPlays) * 100) : 0;

  // 2. User & Community Metrics
  const userStatsRes = await db.execute(`
    SELECT 
      COUNT(*) as total_users,
      SUM(total_score) as total_score_awarded,
      SUM(games_played) as total_user_matches,
      SUM(wins) as total_user_wins
    FROM users;
  `);
  const totalUsers = Number(userStatsRes.rows[0]?.total_users || 0);
  const totalScoreAwarded = Number(userStatsRes.rows[0]?.total_score_awarded || 0);
  const totalUserMatches = Number(userStatsRes.rows[0]?.total_user_matches || 0);

  // 3. Leaderboard Submissions Count
  const lbStatsRes = await db.execute(`SELECT COUNT(*) as total_matches_recorded FROM leaderboard;`);
  const totalMatchesRecorded = Number(lbStatsRes.rows[0]?.total_matches_recorded || 0);

  // 4. Top 10 Most Played Songs
  const topPlayedRes = await db.execute(`
    SELECT id, title, artist, category, difficulty, times_played, times_guessed, times_failed, album_cover
    FROM songs
    WHERE times_played > 0
    ORDER BY times_played DESC, times_guessed DESC
    LIMIT 10;
  `);
  const topPlayed = topPlayedRes.rows.map((r: any) => ({
    id: String(r.id),
    title: String(r.title),
    artist: String(r.artist),
    category: String(r.category),
    difficulty: String(r.difficulty),
    times_played: Number(r.times_played || 0),
    times_guessed: Number(r.times_guessed || 0),
    times_failed: Number(r.times_failed || 0),
    album_cover: r.album_cover,
    accuracy: Number(r.times_played || 0) > 0 ? Math.round((Number(r.times_guessed || 0) / Number(r.times_played)) * 100) : 0,
  }));

  // 5. Top 10 Easiest Songs (Highest accuracy, at least 1 play)
  const easiestRes = await db.execute(`
    SELECT id, title, artist, category, difficulty, times_played, times_guessed, times_failed, album_cover,
      ROUND((times_guessed * 100.0 / MAX(1, times_played)), 1) as accuracy
    FROM songs
    WHERE times_played >= 1 AND times_guessed > 0
    ORDER BY accuracy DESC, times_guessed DESC
    LIMIT 10;
  `);
  const easiestSongs = easiestRes.rows.map((r: any) => ({
    id: String(r.id),
    title: String(r.title),
    artist: String(r.artist),
    category: String(r.category),
    difficulty: String(r.difficulty),
    times_played: Number(r.times_played || 0),
    times_guessed: Number(r.times_guessed || 0),
    times_failed: Number(r.times_failed || 0),
    album_cover: r.album_cover,
    accuracy: Number(r.accuracy || 0),
  }));

  // 6. Top 10 Hardest Songs / Paling Angker (Highest fail rate, at least 1 play)
  const hardestRes = await db.execute(`
    SELECT id, title, artist, category, difficulty, times_played, times_guessed, times_failed, album_cover,
      ROUND((times_failed * 100.0 / MAX(1, times_played)), 1) as fail_rate
    FROM songs
    WHERE times_played >= 1 AND times_failed > 0
    ORDER BY fail_rate DESC, times_failed DESC
    LIMIT 10;
  `);
  const hardestSongs = hardestRes.rows.map((r: any) => ({
    id: String(r.id),
    title: String(r.title),
    artist: String(r.artist),
    category: String(r.category),
    difficulty: String(r.difficulty),
    times_played: Number(r.times_played || 0),
    times_guessed: Number(r.times_guessed || 0),
    times_failed: Number(r.times_failed || 0),
    album_cover: r.album_cover,
    fail_rate: Number(r.fail_rate || 0),
  }));

  // 7. Genre Popularity & Plays Breakdown
  const genreRes = await db.execute(`
    SELECT category, COUNT(*) as song_count, SUM(times_played) as total_plays
    FROM songs
    GROUP BY category
    ORDER BY total_plays DESC, song_count DESC;
  `);
  const genreStats = genreRes.rows.map((r: any) => ({
    category: String(r.category),
    song_count: Number(r.song_count || 0),
    total_plays: Number(r.total_plays || 0),
  }));

  // 8. Recent Match Activity from Leaderboard
  const recentRes = await db.execute(`
    SELECT id, player_name, player_avatar, mode, category, difficulty, score, created_at
    FROM leaderboard
    ORDER BY created_at DESC
    LIMIT 12;
  `);
  const recentMatches = recentRes.rows.map((r: any) => ({
    id: String(r.id),
    player_name: String(r.player_name),
    player_avatar: r.player_avatar,
    mode: String(r.mode),
    category: String(r.category),
    difficulty: String(r.difficulty),
    score: Number(r.score || 0),
    created_at: r.created_at,
  }));

  return {
    overview: {
      totalCatalog,
      totalPlays,
      totalGuesses,
      totalFails,
      globalAccuracy,
      totalUsers,
      totalScoreAwarded,
      totalUserMatches,
      totalMatchesRecorded,
    },
    topPlayed,
    easiestSongs,
    hardestSongs,
    genreStats,
    recentMatches,
  };
}

// -------------------------------------------------------------
// DEEZER ENRICHMENT ENGINE
// -------------------------------------------------------------
export async function getDeezerEnrichmentStats() {
  const countRes = await db.execute(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN deezer_rank > 0 THEN 1 ELSE 0 END) as enriched,
      SUM(CASE WHEN bpm > 0 THEN 1 ELSE 0 END) as with_bpm,
      AVG(CASE WHEN deezer_rank > 0 THEN deezer_rank ELSE NULL END) as avg_rank
    FROM songs;
  `);

  const total = Number(countRes.rows[0]?.total || 0);
  const enriched = Number(countRes.rows[0]?.enriched || 0);
  const withBpm = Number(countRes.rows[0]?.with_bpm || 0);
  const avgRank = Math.round(Number(countRes.rows[0]?.avg_rank || 0));
  const percentage = total > 0 ? Math.round((enriched / total) * 100) : 0;

  const topRankedRes = await db.execute(`
    SELECT id, title, artist, category, difficulty, deezer_rank, bpm, album_cover
    FROM songs
    WHERE deezer_rank > 0
    ORDER BY deezer_rank DESC
    LIMIT 6;
  `);

  const topRanked = topRankedRes.rows.map((r: any) => ({
    id: String(r.id),
    title: String(r.title),
    artist: String(r.artist),
    category: String(r.category),
    difficulty: String(r.difficulty),
    deezer_rank: Number(r.deezer_rank || 0),
    bpm: Number(r.bpm || 0),
    album_cover: r.album_cover,
  }));

  return {
    total,
    enriched,
    pending: total - enriched,
    withBpm,
    avgRank,
    percentage,
    topRanked,
  };
}

function cleanStringForDeezer(str: string) {
  if (!str) return "";
  return str
    .replace(/\s*[\(\[].*?[\)\]]/g, "")
    .replace(/\s*-\s*Single/gi, "")
    .replace(/\s*-\s*EP/gi, "")
    .replace(/\s*-\s*Remastered/gi, "")
    .replace(/\s*-\s*Live/gi, "")
    .trim();
}

function calculateDifficultyFromRank(rank: number) {
  if (rank >= 350000) return "easy";
  if (rank >= 120000) return "medium";
  return "hard";
}

export async function enrichDeezerBatch(batchSize = 30) {
  const songsRes = await db.execute({
    sql: "SELECT id, title, artist, difficulty FROM songs WHERE deezer_rank = 0 OR deezer_rank IS NULL ORDER BY id ASC LIMIT ?;",
    args: [batchSize],
  });

  const pendingSongs = songsRes.rows;
  let processed = 0;
  let matched = 0;

  for (const song of pendingSongs) {
    const cleanT = cleanStringForDeezer(String(song.title));
    const cleanA = cleanStringForDeezer(String(song.artist).split(/feat\.|,|&/i)[0]);
    const query = `${cleanA} ${cleanT}`;

    let deezerRank = 0;
    let bpm = 0;

    try {
      const searchRes = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=3`, {
        headers: { "User-Agent": "TebakLaguEngine/1.0" },
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.data && searchData.data.length > 0) {
          const track = searchData.data[0];
          deezerRank = track.rank || 0;
          matched++;

          if (track.id && deezerRank >= 100000) {
            try {
              const trkRes = await fetch(`https://api.deezer.com/track/${track.id}`, {
                headers: { "User-Agent": "TebakLaguEngine/1.0" },
              });
              if (trkRes.ok) {
                const trkData = await trkRes.json();
                if (trkData.bpm) bpm = Number(trkData.bpm) || 0;
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {}

    const newDifficulty = deezerRank > 0 ? calculateDifficultyFromRank(deezerRank) : song.difficulty;

    await db.execute({
      sql: "UPDATE songs SET deezer_rank = ?, bpm = ?, difficulty = ? WHERE id = ?;",
      args: [deezerRank, bpm, newDifficulty, song.id],
    });

    processed++;
    await new Promise((r) => setTimeout(r, 120));
  }

  return { processed, matched };
}
