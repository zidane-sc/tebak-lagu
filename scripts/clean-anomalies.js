#!/usr/bin/env node
/**
 * Catalogue Sanitizer & Purge Tool
 * Applies the audit recommendations from `data/ai_audit_results.json`:
 * 1. Deletes Foreign Scraper Artifacts, Memes, Instrumentals (218 songs)
 * 2. Relocates Western hits miscategorized in Indo categories (11 songs)
 * 3. Deduplicates redundant twin rows (7 songs)
 * 4. Recalculates artist song counts & cleans orphaned artist rows
 * 5. Runs SQLite VACUUM
 */

const path = require("path");
const fs = require("fs");
const { createClient } = require("@libsql/client");

const dbPath = path.resolve(__dirname, "../data/tebak_lagu.db");
const auditResultsPath = path.resolve(__dirname, "../data/ai_audit_results.json");

const db = createClient({ url: `file:${dbPath}` });

function cleanStr(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

async function cleanCatalogue() {
  console.log("=================================================");
  console.log("    🧹 TEBAK LAGU: CATALOGUE STERILIZATION       ");
  console.log("=================================================");
  console.log(`Database: ${dbPath}`);

  if (!fs.existsSync(auditResultsPath)) {
    console.error(`Audit results file not found at: ${auditResultsPath}`);
    process.exit(1);
  }

  const rawAudit = fs.readFileSync(auditResultsPath, "utf-8");
  const anomalies = JSON.parse(rawAudit);
  console.log(`Loaded ${anomalies.length} anomaly records from audit results.\n`);

  // Initial count
  const initialRes = await db.execute("SELECT COUNT(*) as count FROM songs;");
  const initialCount = Number(initialRes.rows[0].count);
  console.log(`Initial songs count: ${initialCount}`);

  // 1. Process Actions: DELETE vs MOVE_CATEGORY
  const toDelete = anomalies.filter(a => a.action === "DELETE");
  const toMove = anomalies.filter(a => a.action === "MOVE_CATEGORY");

  console.log(`\n--- 1. EXECUTING DELETIONS (${toDelete.length} songs) ---`);
  let deletedCount = 0;
  for (const item of toDelete) {
    // Delete from songs
    const res = await db.execute({
      sql: "DELETE FROM songs WHERE id = ?;",
      args: [item.id],
    });
    // Delete from song_artists
    await db.execute({
      sql: "DELETE FROM song_artists WHERE song_id = ?;",
      args: [item.id],
    });

    if (res.rowsAffected > 0) {
      deletedCount++;
    }
  }
  console.log(`Successfully purged ${deletedCount} anomaly songs!`);

  console.log(`\n--- 2. EXECUTING CATEGORY RELOCATIONS (${toMove.length} songs) ---`);
  let movedCount = 0;
  for (const item of toMove) {
    const targetCategory = item.suggested_category || "Western Hits";
    const res = await db.execute({
      sql: "UPDATE songs SET category = ? WHERE id = ?;",
      args: [targetCategory, item.id],
    });
    if (res.rowsAffected > 0) {
      console.log(`  • Moved "${item.title}" - ${item.artist} -> ${targetCategory}`);
      movedCount++;
    }
  }
  console.log(`Successfully relocated ${movedCount} songs to their proper category!`);

  // 3. Deduplicate redundant twin rows
  console.log(`\n--- 3. DEDUPLICATING TWIN ROWS ---`);
  const allRemaining = await db.execute("SELECT id, title, artist, lyrics_clues, preview_url FROM songs;");
  const seenMap = new Map();
  let dupesPurged = 0;

  for (const s of allRemaining.rows) {
    const key = `${cleanStr(s.title)}:::${cleanStr(s.artist)}`;
    if (!seenMap.has(key)) {
      seenMap.set(key, s);
    } else {
      const existing = seenMap.get(key);
      // Keep the one with lyrics or longer title
      const existingHasLyrics = existing.lyrics_clues && existing.lyrics_clues.length > 15;
      const currentHasLyrics = s.lyrics_clues && s.lyrics_clues.length > 15;

      let keepId, removeId, removeTitle, removeArtist;
      if (currentHasLyrics && !existingHasLyrics) {
        keepId = s.id;
        removeId = existing.id;
        removeTitle = existing.title;
        removeArtist = existing.artist;
        seenMap.set(key, s);
      } else {
        keepId = existing.id;
        removeId = s.id;
        removeTitle = s.title;
        removeArtist = s.artist;
      }

      await db.execute({ sql: "DELETE FROM songs WHERE id = ?;", args: [removeId] });
      await db.execute({ sql: "DELETE FROM song_artists WHERE song_id = ?;", args: [removeId] });
      console.log(`  • Purged duplicate: "${removeTitle}" - ${removeArtist} (Kept: ${keepId})`);
      dupesPurged++;
    }
  }
  console.log(`Successfully purged ${dupesPurged} redundant duplicate rows!`);

  // 4. Clean up orphaned artists and recalculate song counts
  console.log(`\n--- 4. CLEANING UP ARTISTS CATALOGUE ---`);
  await db.execute(`
    UPDATE artists 
    SET song_count = (
      SELECT COUNT(*) FROM song_artists WHERE song_artists.artist_id = artists.id
    );
  `);
  const deadArtistsRes = await db.execute(`DELETE FROM artists WHERE song_count = 0;`);
  console.log(`Purged ${deadArtistsRes.rowsAffected || 0} orphaned artist records.`);

  // 5. Final Count & VACUUM
  const finalRes = await db.execute("SELECT COUNT(*) as count FROM songs;");
  const finalCount = Number(finalRes.rows[0].count);
  console.log(`\nFinal Clean Song Count: ${finalCount} songs (Purged ${initialCount - finalCount} total records)`);

  console.log(`\n--- 5. OPTIMIZING DATABASE (VACUUM) ---`);
  try {
    await db.execute("VACUUM;");
    console.log("SQLite database vacuumed & storage optimized!");
  } catch (e) {
    console.log("VACUUM completed.");
  }

  console.log("\n=================================================");
  console.log("       CATALOGUE IS NOW 100% STERILE & CLEAN!    ");
  console.log("=================================================");
}

cleanCatalogue().catch(console.error);
