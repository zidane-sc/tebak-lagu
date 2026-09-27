const { createClient } = require("@libsql/client");
const path = require("path");
const fs = require("fs");

const db = createClient({ url: `file:${path.resolve(__dirname, "../data/tebak_lagu.db")}` });

async function exportCatalog() {
  console.log("=== Exporting Tebak Lagu Catalog for Curation ===\n");

  // 1. Artists Summary (sorted by song count)
  const artistsRes = await db.execute(`
    SELECT 
      a.id,
      a.name,
      a.category,
      a.is_active,
      COUNT(DISTINCT sa.song_id) as song_count
    FROM artists a
    LEFT JOIN song_artists sa ON a.id = sa.artist_id
    GROUP BY a.id
    ORDER BY song_count DESC, a.name ASC;
  `);

  const artistsSummary = artistsRes.rows.map(r => ({
    id: r.id,
    name: r.name,
    category: r.category || "Unknown",
    is_active: r.is_active === 1 ? "✓" : "✗",
    song_count: r.song_count
  }));

  // 2. Songs by artist (for detailed review)
  const songsRes = await db.execute(`
    SELECT 
      s.id,
      s.title,
      s.artist,
      s.category,
      s.year,
      s.deezer_rank,
      s.times_played,
      s.is_active
    FROM songs s
    ORDER BY s.artist ASC, s.deezer_rank DESC;
  `);

  const songsDetail = songsRes.rows.map(r => ({
    id: r.id,
    title: r.title,
    artist: r.artist,
    category: r.category,
    year: r.year || "N/A",
    deezer_rank: r.deezer_rank || 0,
    times_played: r.times_played || 0,
    is_active: r.is_active === 1 ? "✓" : "✗"
  }));

  // 3. Stats summary
  const statsRes = await db.execute(`
    SELECT 
      COUNT(*) as total_songs,
      COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_songs,
      COUNT(CASE WHEN is_active = 0 THEN 1 END) as disabled_songs
    FROM songs;
  `);

  const artistCountRes = await db.execute(`SELECT COUNT(*) as cnt FROM artists;`);

  const stats = {
    total_songs: statsRes.rows[0].total_songs,
    active_songs: statsRes.rows[0].active_songs,
    disabled_songs: statsRes.rows[0].disabled_songs,
    unique_artists: artistCountRes.rows[0].cnt
  };

  // Write to files
  const exportDir = path.resolve(__dirname, "../exports");
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

  const timestamp = new Date().toISOString().split("T")[0];

  // Artists CSV
  const artistsCsv = [
    "ID,Name,Category,Active,Song Count",
    ...artistsSummary.map(a => `"${a.id}","${a.name}","${a.category}","${a.is_active}",${a.song_count}`)
  ].join("\n");
  fs.writeFileSync(`${exportDir}/artists_summary_${timestamp}.csv`, artistsCsv);

  // Songs CSV
  const songsCsv = [
    "ID,Title,Artist,Category,Year,Deezer Rank,Times Played,Active",
    ...songsDetail.map(s => `"${s.id}","${s.title}","${s.artist}","${s.category}","${s.year}",${s.deezer_rank},${s.times_played},"${s.is_active}"`)
  ].join("\n");
  fs.writeFileSync(`${exportDir}/songs_detail_${timestamp}.csv`, songsCsv);

  // Artists by song count (for easy review)
  const artistsBySongCount = {};
  artistsSummary.forEach(a => {
    const bucket = a.song_count <= 2 ? "1-2 songs" : a.song_count <= 5 ? "3-5 songs" : a.song_count <= 10 ? "6-10 songs" : "11+ songs";
    if (!artistsBySongCount[bucket]) artistsBySongCount[bucket] = [];
    artistsBySongCount[bucket].push(a);
  });

  // Markdown summary
  const mdReport = `# Tebak Lagu Catalog Report
Generated: ${new Date().toISOString()}

## 📊 Statistics
- **Total Songs:** ${stats.total_songs}
- **Active Songs:** ${stats.active_songs}
- **Disabled Songs:** ${stats.disabled_songs}
- **Unique Artists:** ${stats.unique_artists}

## 🎤 Top 50 Artists by Song Count
| Artist | Category | Active | Songs |
|--------|----------|--------|-------|
${artistsSummary.slice(0, 50).map(a => `| ${a.name} | ${a.category} | ${a.is_active} | ${a.song_count} |`).join("\n")}

## 📝 Artists Grouped by Song Count

### 1-2 songs (${artistsBySongCount["1-2 songs"]?.length || 0} artists)
${(artistsBySongCount["1-2 songs"] || []).map(a => `- **${a.name}** (${a.category}): ${a.song_count} song(s) ${a.is_active === "✗" ? "[DISABLED]" : ""}`).join("\n") || "None"}

### 3-5 songs (${artistsBySongCount["3-5 songs"]?.length || 0} artists)
${(artistsBySongCount["3-5 songs"] || []).slice(0, 30).map(a => `- **${a.name}** (${a.category}): ${a.song_count} songs`).join("\n") || "None"}

### 6-10 songs (${artistsBySongCount["6-10 songs"]?.length || 0} artists)
${(artistsBySongCount["6-10 songs"] || []).slice(0, 20).map(a => `- **${a.name}** (${a.category}): ${a.song_count} songs`).join("\n") || "None"}

### 11+ songs (${artistsBySongCount["11+ songs"]?.length || 0} artists)
${(artistsBySongCount["11+ songs"] || []).map(a => `- **${a.name}** (${a.category}): ${a.song_count} songs`).join("\n") || "None"}

## 📄 Export Files
- \`artists_summary_${timestamp}.csv\` — All artists with song counts
- \`songs_detail_${timestamp}.csv\` — Complete song catalog with metadata
`;

  fs.writeFileSync(`${exportDir}/catalog_report_${timestamp}.md`, mdReport);

  console.log(`\n✅ Export complete!`);
  console.log(`\nFiles saved to: ${exportDir}/`);
  console.log(`- artists_summary_${timestamp}.csv (${artistsSummary.length} artists)`);
  console.log(`- songs_detail_${timestamp}.csv (${songsDetail.length} songs)`);
  console.log(`- catalog_report_${timestamp}.md (summary report)`);
  console.log(`\n📊 Quick Stats:`);
  console.log(`   Total Songs: ${stats.total_songs}`);
  console.log(`   Active: ${stats.active_songs} | Disabled: ${stats.disabled_songs}`);
  console.log(`   Total Artists: ${stats.unique_artists}`);
  console.log(`   Artists with 1-2 songs: ${artistsBySongCount["1-2 songs"]?.length || 0}`);
}

exportCatalog().catch(console.error);
