import { NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import https from "https";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

const OFFICIAL_KEYWORDS = [
  "official audio",
  "official video",
  "official music video",
  "official mv",
  "vevo",
  "sony music",
  "warner music",
  "universal music",
  "musica studio",
  "musica studios",
  "gp records",
  "nagaswara",
  "hits records",
  "indie pop",
];

interface YTCandidate {
  videoId: string;
  title: string;
  channel: string;
  duration: string;
  score: number;
}

function fetchYouTubeSearch(query: string): Promise<Omit<YTCandidate, "score">[]> {
  return new Promise((resolve) => {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const req = https.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
        "Accept": "text/html,application/xhtml+xml",
        "Cookie": "CONSENT=YES+1; YSC=x; VISITOR_INFO1_LIVE=x",
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const data = Buffer.concat(chunks).toString("utf-8");
        try {
          const match = data.match(/var ytInitialData = ({.*?});<\/script>/s);
          if (!match) return resolve([]);

          const parsed = JSON.parse(match[1]);
          const contents =
            parsed.contents?.twoColumnSearchResultsRenderer?.primaryContents
              ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

          const results: Omit<YTCandidate, "score">[] = [];
          for (const item of contents) {
            const v = item.videoRenderer;
            if (v?.videoId) {
              results.push({
                videoId: v.videoId,
                title: v.title?.runs?.[0]?.text || "",
                channel: v.ownerText?.runs?.[0]?.text || "",
                duration: v.lengthText?.simpleText || "",
              });
              if (results.length >= 6) break;
            }
          }
          resolve(results);
        } catch {
          resolve([]);
        }
      });
    });
    req.on("error", () => resolve([]));
    req.setTimeout(12000, () => {
      req.destroy();
      resolve([]);
    });
  });
}

function scoreCandidate(c: Omit<YTCandidate, "score">, artist: string, title: string): number {
  let score = 0;
  const titleLow = (c.title || "").toLowerCase();
  const channelLow = (c.channel || "").toLowerCase();
  const artistTokens = artist.toLowerCase().split(/[\s,&]+/).filter((t) => t.length > 2);
  const titleTokens = title.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  // Channel name matches artist (strongest signal)
  for (const token of artistTokens) {
    if (channelLow.includes(token)) {
      score += 40;
      break;
    }
  }
  // Channel is the artist's own channel
  if (channelLow.replace(/\s/g, "").includes(artist.toLowerCase().replace(/\s/g, "").slice(0, 8))) {
    score += 20;
  }
  // Title contains the song name
  for (const token of titleTokens) {
    if (titleLow.includes(token)) {
      score += 25;
      break;
    }
  }
  // Title contains the artist name
  for (const token of artistTokens) {
    if (titleLow.includes(token)) {
      score += 15;
      break;
    }
  }
  // Official keywords
  for (const kw of OFFICIAL_KEYWORDS) {
    if (titleLow.includes(kw) || channelLow.includes(kw)) {
      score += 20;
      break;
    }
  }
  // Penalise obvious noise: live cover, karaoke, lyric video by fan channel
  const noise = ["karaoke", "cover band", "tributa", "instrumental cover", "sped up", "slowed"];
  for (const n of noise) {
    if (titleLow.includes(n)) score -= 25;
  }

  return score;
}

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const title = (searchParams.get("title") || "").trim();
    const artist = (searchParams.get("artist") || "").trim();

    if (!title || !artist) {
      return NextResponse.json(
        { error: "Parameter title dan artist wajib diisi" },
        { status: 400 }
      );
    }

    const candidates = await fetchYouTubeSearch(`${artist} ${title}`);

    const scored: YTCandidate[] = candidates
      .map((c) => ({ ...c, score: scoreCandidate(c, artist, title) }))
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({
      results: scored,
      query: `${artist} ${title}`,
    });
  } catch (err: any) {
    console.error("YouTube search API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Batch enrich songs that don't have youtube_id yet
export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(5, parseInt(searchParams.get("limit") || "25", 10)));

    await initDb();

    const res = await db.execute({
      sql: `
        SELECT id, title, artist
        FROM songs
        WHERE is_active = 1
          AND (youtube_status IS NULL OR youtube_status = 'pending')
        ORDER BY deezer_rank DESC, popularity DESC
        LIMIT ?
      `,
      args: [limit],
    });

    const songs = res.rows;
    let found = 0;
    let notFound = 0;

    for (const song of songs) {
      try {
        const candidates = await fetchYouTubeSearch(`${song.artist} ${song.title}`);
        if (candidates.length > 0) {
          const scored = candidates
            .map((c) => ({ ...c, score: scoreCandidate(c, String(song.artist), String(song.title)) }))
            .sort((a, b) => b.score - a.score);
          const best = scored[0];

          await db.execute({
            sql: `
              UPDATE songs
              SET youtube_id = ?,
                  youtube_status = 'ready',
                  youtube_start_second = 20,
                  youtube_checked_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
            args: [best.videoId, song.id],
          });
          found++;
        } else {
          await db.execute({
            sql: `UPDATE songs SET youtube_status = 'not_found', youtube_checked_at = CURRENT_TIMESTAMP WHERE id = ?`,
            args: [song.id],
          });
          notFound++;
        }
      } catch {
        // skip on error
      }
      await new Promise((r) => setTimeout(r, 700));
    }

    return NextResponse.json({
      success: true,
      processed: songs.length,
      found,
      notFound,
    });
  } catch (err: any) {
    console.error("YouTube batch enrich error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
