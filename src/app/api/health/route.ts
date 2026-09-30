import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liveness probe for the Fly health check. Deliberately reads a real table:
 * a process that is up but has lost the volume mount, or a database that has
 * stopped answering, is not healthy — and `auto_stop_machines = "off"` means a
 * hung node would otherwise keep serving 5xx forever with no restart.
 *
 * Keep it cheap: one indexed COUNT, no catalogue scan, no external calls.
 * `SELECT 1` is deliberately not used — SQLite answers it from the connection
 * without opening the file, so it would report healthy against a corrupt or
 * missing database.
 */
export async function GET() {
  const started = Date.now();
  try {
    const res = await db.execute("SELECT COUNT(*) AS n FROM songs WHERE is_active = 1;");
    const songs = Number(res.rows[0]?.n ?? 0);
    if (songs === 0) {
      return NextResponse.json(
        { ok: false, error: "catalogue is empty", songs, ms: Date.now() - started },
        { status: 503 }
      );
    }
    return NextResponse.json({ ok: true, songs, ms: Date.now() - started });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message, ms: Date.now() - started },
      { status: 503 }
    );
  }
}
