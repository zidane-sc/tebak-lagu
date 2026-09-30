import { NextResponse } from "next/server";
import { initDb, db, getUserById } from "@/lib/db";
import { requireUser, sessionUserId } from "@/lib/session-guard";

export const dynamic = "force-dynamic";

/**
 * The signed-in player's own statistics.
 *
 * Everything here is derived from rows that already exist — leaderboard entries
 * and per-song guess counters — so it costs no new writes. The counters on the
 * user row (total_score, games_played, wins) come from the score API; the mode
 * breakdown, best streak and favourite come from the leaderboard history.
 */
export async function GET(request: Request) {
  try {
    await initDb();

    const denied = await requireUser(request);
    if (denied) return denied;

    const userId = await sessionUserId(request);
    const user = await getUserById(userId!);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Leaderboard rows are matched on both id and name: guest rows have a null
    // user_id, and a renamed player would otherwise silently lose their history.
    const scope = [userId!, user.name];

    // Per-mode breakdown from the leaderboard history.
    const byMode = await db.execute({
      sql: `SELECT mode, COUNT(*) AS games, MAX(score) AS best, SUM(score) AS total,
                   SUM(CASE WHEN score >= 0 THEN 1 ELSE 0 END) AS counted
            FROM leaderboard
            WHERE user_id = ? AND player_name = ?
            GROUP BY mode
            ORDER BY total DESC;`,
      args: scope,
    });

    // The hardest song this player has ever been served, and their best run.
    const bestEntry = await db.execute({
      sql: `SELECT score, mode, category, difficulty, created_at
            FROM leaderboard
            WHERE user_id = ? AND player_name = ?
            ORDER BY score DESC, created_at DESC
            LIMIT 1;`,
      args: scope,
    });

    // Recent form, newest first, for a small "last five" strip.
    const recent = await db.execute({
      sql: `SELECT score, mode, difficulty, created_at
            FROM leaderboard
            WHERE user_id = ? AND player_name = ?
            ORDER BY created_at DESC
            LIMIT 5;`,
      args: scope,
    });

    // Catalogue-wide song counters are NOT returned here. times_played lives on
    // the song row and is shared by every player, so presenting it as a personal
    // stat would be a lie. Per-player song history needs a leaderboard column
    // for the song, which does not exist yet.
    const perMode = Object.fromEntries(
      (byMode.rows || []).map((r) => [
        String(r.mode),
        { games: Number(r.games || 0), best: Number(r.best || 0), total: Number(r.total || 0) },
      ])
    );
    const gamesLogged = Object.values(perMode).reduce((n, m) => n + m.games, 0);
    const winRate = user.games_played > 0
      ? Math.round((user.wins / user.games_played) * 100)
      : 0;

    return NextResponse.json({
      user,
      summary: {
        totalScore: user.total_score,
        gamesPlayed: user.games_played,
        wins: user.wins,
        winRate,
        gamesLogged,
        bestScore: bestEntry.rows[0] ? Number(bestEntry.rows[0].score) : 0,
      },
      byMode: perMode,
      bestEntry: bestEntry.rows[0]
        ? {
            score: Number(bestEntry.rows[0].score),
            mode: String(bestEntry.rows[0].mode),
            category: String(bestEntry.rows[0].category),
            difficulty: String(bestEntry.rows[0].difficulty),
            at: bestEntry.rows[0].created_at,
          }
        : null,
      recent: (recent.rows || []).map((r) => ({
        score: Number(r.score),
        mode: String(r.mode),
        difficulty: String(r.difficulty),
        at: r.created_at,
      })),
    });
  } catch (err: any) {
    console.error("Auth stats API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
