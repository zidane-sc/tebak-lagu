const { createClient } = require("@libsql/client");
const path = require("path");

const DB_PATH = process.env.DATABASE_URL || `file:${path.join(__dirname, "../../data/tebak_lagu.db")}`;
const db = createClient({ url: DB_PATH });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanString(str) {
  if (!str) return "";
  return str
    .replace(/\s*[\(\[].*?[\)\]]/g, "")
    .replace(/\s*-\s*Single/gi, "")
    .replace(/\s*-\s*EP/gi, "")
    .replace(/\s*-\s*Remastered/gi, "")
    .replace(/\s*-\s*Live/gi, "")
    .trim();
}

function calculateDifficulty(rank) {
  if (rank >= 350000) return "easy";
  if (rank >= 120000) return "medium";
  return "hard";
}

async function fetchDeezer(query, retries = 3) {
  const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=3`;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "TebakLaguEngine/1.0" } });
      if (res.status === 429) {
        console.log(`[Rate Limit 429] Waiting 5s before retry...`);
        await sleep(5000);
        continue;
      }
      const data = await res.json();
      if (data.error && data.error.code === 4) {
        // Quota limit exceeded
        console.log(`[Quota Limit 4] Waiting 5s before retry...`);
        await sleep(5000);
        continue;
      }
      return data;
    } catch (err) {
      if (attempt === retries - 1) return null;
      await sleep(1000);
    }
  }
  return null;
}

async function fetchTrackDetails(trackId, retries = 2) {
  if (!trackId) return null;
  const url = `https://api.deezer.com/track/${trackId}`;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "TebakLaguEngine/1.0" } });
      if (res.status === 429 || res.status === 403) {
        await sleep(3000);
        continue;
      }
      const data = await res.json();
      if (data.error) return null;
      return data;
    } catch (e) {
      return null;
    }
  }
  return null;
}

async function runEnrichment(maxToProcess = 5000) {
  console.log("=== Memulai Deezer API Enrichment Pipeline ===");
  console.log(`Target Database: ${DB_PATH}`);

  // 1. Get stats
  const countRes = await db.execute("SELECT COUNT(*) as total, SUM(CASE WHEN deezer_rank > 0 THEN 1 ELSE 0 END) as enriched FROM songs;");
  const total = Number(countRes.rows[0].total);
  const alreadyEnriched = Number(countRes.rows[0].enriched || 0);

  console.log(`Status Saat Ini: ${alreadyEnriched} / ${total} lagu sudah memiliki Deezer metadata.`);

  // 2. Query pending songs
  const songsRes = await db.execute({
    sql: "SELECT id, title, artist, category, difficulty FROM songs WHERE deezer_rank = 0 OR deezer_rank IS NULL ORDER BY id ASC LIMIT ?;",
    args: [maxToProcess],
  });

  const pendingSongs = songsRes.rows;
  console.log(`Mengambil batch ${pendingSongs.length} lagu untuk diperkaya...\n`);

  let processed = 0;
  let matched = 0;

  for (const song of pendingSongs) {
    const cleanT = cleanString(song.title);
    const cleanA = cleanString(song.artist.split(/feat\.|,|&/i)[0]);
    const query = `${cleanA} ${cleanT}`;

    const searchData = await fetchDeezer(query);
    let deezerRank = 0;
    let bpm = 0;
    let trackId = null;

    if (searchData && searchData.data && searchData.data.length > 0) {
      // Find track with highest rank or best match
      const track = searchData.data[0];
      deezerRank = track.rank || 0;
      trackId = track.id;
      matched++;

      // Optionally fetch BPM for tracks with good rank
      if (trackId && deezerRank >= 100000) {
        await sleep(60);
        const details = await fetchTrackDetails(trackId);
        if (details && details.bpm) {
          bpm = Number(details.bpm) || 0;
        }
      }
    }

    // Fallback rank if not matched on Deezer: keep difficulty or assign default
    const newDifficulty = deezerRank > 0 ? calculateDifficulty(deezerRank) : song.difficulty;

    await db.execute({
      sql: "UPDATE songs SET deezer_rank = ?, bpm = ?, difficulty = ? WHERE id = ?;",
      args: [deezerRank, bpm, newDifficulty, song.id],
    });

    processed++;

    if (processed % 10 === 0 || processed === pendingSongs.length) {
      const pct = Math.round(((alreadyEnriched + processed) / total) * 100);
      console.log(
        `[${pct}% | ${alreadyEnriched + processed}/${total}] Diproses: ${processed} | Match: ${matched} | Terakhir: ${song.artist} - ${song.title} -> Rank: ${deezerRank} (Diff: ${newDifficulty}, BPM: ${bpm})`
      );
    }

    // Polite rate limit: ~8 requests/sec
    await sleep(130);
  }

  console.log("\n=== Enrichment Selesai! ===");
  console.log(`Total Diproses: ${processed}`);
  console.log(`Total Berhasil Match di Deezer: ${matched}`);
}

if (require.main === module) {
  const limit = parseInt(process.argv[2] || "5000", 10);
  runEnrichment(limit).catch((err) => {
    console.error("Fatal enrichment error:", err);
    process.exit(1);
  });
}

module.exports = { runEnrichment, cleanString, calculateDifficulty, fetchDeezer };
