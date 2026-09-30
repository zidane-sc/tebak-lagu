// Assert-based self-check for the health probe's failure modes. Run:
//   node scripts/check-health-probe.js
//
// The bug this guards: `SELECT 1` answers from the connection without opening
// the database file, so it reports healthy against a corrupt or missing DB.
const assert = require("assert");
const fs = require("fs");
const { createClient } = require("@libsql/client");

const REAL_DB = "/data/workspace/tebak-lagu/data/tebak_lagu.db";

async function probeQuery(client) {
  const res = await client.execute("SELECT COUNT(*) AS n FROM songs WHERE is_active = 1;");
  return Number(res.rows[0]?.n ?? 0);
}

(async () => {
  // 1. The naive query really is blind to corruption — prove the reason this
  //    probe touches a table instead.
  const corruptPath = "/tmp/tl-corrupt-probe.db";
  fs.writeFileSync(corruptPath, "this is not a sqlite file at all");
  const corrupt = createClient({ url: `file:${corruptPath}` });
  await corrupt.execute("SELECT 1"); // passes — that is the whole problem
  let tableQueryThrew = false;
  try {
    await probeQuery(corrupt);
  } catch {
    tableQueryThrew = true;
  }
  assert.ok(tableQueryThrew, "reading a table must reject a corrupt database file");
  fs.unlinkSync(corruptPath);

  // 2. A missing file must reject too (lost volume mount). createClient itself
  //    throws here rather than the query, so both shapes count as unhealthy.
  let missingThrew = false;
  try {
    const missing = createClient({ url: "file:/tmp/tl-no-such-dir/tebak_lagu.db" });
    await probeQuery(missing);
  } catch {
    missingThrew = true;
  }
  assert.ok(missingThrew, "a missing volume must be treated as unhealthy");

  // 3. The real database passes and reports a non-zero catalogue.
  const real = createClient({ url: `file:${REAL_DB}` });
  const n = await probeQuery(real);
  assert.ok(n > 0, `real catalogue must be non-empty, got ${n}`);

  // 4. An empty catalogue is treated as unhealthy: a mounted-but-empty volume
  //    means initDb never seeded, and serving a blank game is worse than 503.
  const emptyPath = "/tmp/tl-empty-probe.db";
  const empty = createClient({ url: `file:${emptyPath}` });
  await empty.execute("CREATE TABLE songs (id TEXT PRIMARY KEY, is_active INTEGER);");
  assert.strictEqual(await probeQuery(empty), 0, "empty catalogue must read as 0, which maps to 503");
  fs.unlinkSync(emptyPath);

  console.log("health-probe: all 4 assertions passed");
})().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
