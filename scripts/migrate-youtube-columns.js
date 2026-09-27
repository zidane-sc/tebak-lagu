const { createClient } = require("@libsql/client");
const path = require("path");

const db = createClient({ url: `file:${path.resolve(__dirname, "../data/tebak_lagu.db")}` });

async function migrate() {
  console.log("=== YouTube Columns Migration ===\n");

  await db.execute("PRAGMA journal_mode = WAL;");

  const columns = [
    ["youtube_id", "TEXT DEFAULT NULL"],
    ["youtube_start_second", "INTEGER DEFAULT 20"],
    ["youtube_status", "TEXT DEFAULT 'pending'"],
    ["youtube_checked_at", "DATETIME DEFAULT NULL"],
  ];

  for (const [col, def] of columns) {
    try {
      await db.execute(`ALTER TABLE songs ADD COLUMN ${col} ${def};`);
      console.log(`✅ Added: ${col}`);
    } catch (e) {
      console.log(`⚠️  ${col} already exists — skip`);
    }
  }

  // Index buat filter lagu eligible
  try {
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_songs_youtube_status
      ON songs(youtube_status, is_active);
    `);
    console.log("✅ Index idx_songs_youtube_status created");
  } catch (e) {}

  // Verify
  const res = await db.execute("PRAGMA table_info(songs);");
  const ytCols = res.rows.filter(r => String(r.name).startsWith("youtube_"));
  console.log("\n📋 YouTube columns in songs table:");
  ytCols.forEach(c => console.log(`   ${c.name} (${c.type})`));

  console.log("\n=== Migration Done ===");
}

migrate().catch(console.error);
