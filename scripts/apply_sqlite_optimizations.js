const { createClient } = require("@libsql/client");
const path = require("path");

const dbPath = path.resolve(__dirname, "../data/tebak_lagu.db");
const db = createClient({ url: `file:${dbPath}` });

async function applyOptimizations() {
  console.log("=== Applying SQLite / LibSQL Optimizations ===");

  // 1. WAL Mode & Concurrency Pragmas
  console.log("1. Enabling WAL Mode & Concurrency Tuning...");
  const walRes = await db.execute("PRAGMA journal_mode = WAL;");
  console.log("   Journal Mode:", walRes.rows[0]);
  await db.execute("PRAGMA busy_timeout = 5000;");
  await db.execute("PRAGMA synchronous = NORMAL;");
  console.log("   Busy Timeout set to 5000ms & Synchronous set to NORMAL.");

  // 2. Soft Delete columns in `users`
  console.log("2. Adding Soft Delete support to users table...");
  try {
    await db.execute("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1;");
    console.log("   Added is_active to users.");
  } catch (e) {
    console.log("   is_active in users already exists or", e.message);
  }

  try {
    await db.execute("ALTER TABLE users ADD COLUMN deleted_at DATETIME DEFAULT NULL;");
    console.log("   Added deleted_at to users.");
  } catch (e) {
    console.log("   deleted_at in users already exists or", e.message);
  }

  // 3. FTS5 Virtual Table for Instant Search
  console.log("3. Setting up FTS5 Virtual Table & Auto-Sync Triggers...");
  await db.execute(`
    CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts USING fts5(
      id UNINDEXED,
      title,
      artist,
      search_query,
      tokenize = 'unicode61 remove_diacritics 2'
    );
  `);
  console.log("   Created songs_fts virtual table.");

  // Populate or refresh songs_fts
  const ftsCount = await db.execute("SELECT COUNT(*) as c FROM songs_fts;");
  const count = Number(ftsCount.rows[0]?.c || 0);
  console.log(`   Current songs_fts count: ${count}`);

  if (count === 0) {
    console.log("   Populating songs_fts from songs table...");
    await db.execute(`
      INSERT INTO songs_fts(id, title, artist, search_query)
      SELECT id, title, artist, COALESCE(search_query, title || ' ' || artist)
      FROM songs;
    `);
    const newCount = await db.execute("SELECT COUNT(*) as c FROM songs_fts;");
    console.log(`   Populated songs_fts with ${newCount.rows[0]?.c} records!`);
  }

  // Setup auto-sync triggers
  console.log("   Creating auto-sync triggers (songs_ai, songs_ad, songs_au)...");
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
  console.log("   Triggers configured.");

  console.log("=== All Optimizations Successfully Applied! ===");
}

applyOptimizations().catch(console.error);
