import { createClient, Client } from "@libsql/client";
import path from "path";
import fs from "fs";

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

// Initialize Schema and Auto-Seed if empty
export async function initDb() {
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

  // 2. Check if songs table is empty -> Auto-seed from songs.json
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
        const stmts = chunk.map((s: any) => ({
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

// Query random song matching category & difficulty
export async function getRandomSong(category?: string | null, difficulty?: string | null) {
  let sql = "SELECT * FROM songs WHERE 1=1";
  const args: any[] = [];

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
    // Fallback: pick any song
    const fallback = await db.execute("SELECT * FROM songs ORDER BY RANDOM() LIMIT 1;");
    return rowToSong(fallback.rows[0]);
  }

  return rowToSong(res.rows[0]);
}

// Pre-roll a queue of distinct songs for a match
export async function getMatchSongsQueue(category?: string | null, difficulty?: string | null, count: number = 5) {
  let sql = "SELECT * FROM songs WHERE 1=1";
  const args: any[] = [];

  if (category && category !== "all" && category !== "Semua Genre") {
    sql += " AND category = ?";
    args.push(category);
  }

  if (difficulty && difficulty !== "all") {
    sql += " AND difficulty = ?";
    args.push(difficulty);
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
  total_score: number;
  games_played: number;
  wins: number;
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
    total_score: Number(row.total_score || 0),
    games_played: Number(row.games_played || 0),
    wins: Number(row.wins || 0),
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
      sql: `UPDATE users SET name = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
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
      INSERT INTO users (id, email, name, avatar, total_score, games_played, wins)
      VALUES (?, ?, ?, ?, 0, 0, 0);
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
    sql: "SELECT * FROM users WHERE id = ?;",
    args: [userId],
  });
  if (res.rows.length === 0) return null;
  return rowToUser(res.rows[0]);
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
          WHERE total_score > 0
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
