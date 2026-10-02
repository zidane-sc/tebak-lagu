/**
 * Regression check for "Time Slice round has no sound".
 *
 * Root cause: getRandomSong() gated Time Slice on
 * `youtube_status='ready' AND youtube_id IS NOT NULL`, but its exhaustion path
 * then stripped that very gate and served any song at all. 189 of 3000 rows are
 * `not_found` with a NULL youtube_id, so those rounds rendered a dead play
 * button and were unwinnable — the "no audio" report.
 *
 * Asserted against the real catalogue, not a fixture: the pool that a player
 * actually draws from.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SRC = path.join(__dirname, "..", "src", "lib", "db.ts");
const src = fs.readFileSync(SRC, "utf8");

const checks = [];
const test = (name, fn) => {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (e) {
    checks.push({ name, ok: false, err: e.message });
  }
};

// ── 1. The relaxation must not strip the YouTube gate for Time Slice ───────
test("Time Slice exhaustion never drops the YouTube gate", () => {
  assert.ok(
    /const\s+relaxedSql\s*=\s*\n?\s*mode === "heardle"\s*\n?\s*\?\s*sql\.replace\(lyricsGate,\s*""\)/.test(
      src,
    ),
    "the heardle branch must drop only the lyrics gate",
  );
  // The heardle branch must not touch youtubeGate.
  const heardleBranch = src.match(
    /mode === "heardle"\s*\n?\s*\?\s*sql\.replace\(lyricsGate,\s*""\)\s*\n?\s*:\s*sql\.replace\([\s\S]{0,120}?\)/,
  );
  assert.ok(heardleBranch, "expected a heardle/tts branch in relaxedSql");
  assert.ok(
    !/replace\(youtubeGate/.test(heardleBranch[0].split(":")[0]),
    "the heardle branch must not remove the YouTube gate",
  );
});

// ── 2. The last-resort fallback must stay playable for Time Slice ──────────
test("the last-resort fallback is constrained for Time Slice", () => {
  const block = src.slice(src.indexOf("Absolute last resort"), src.indexOf("const fallback"));
  assert.ok(
    /if\s*\(mode === "heardle"\)/.test(block),
    "the last-resort path must branch on mode",
  );
  assert.ok(
    /youtube_status = 'ready' AND youtube_id IS NOT NULL/.test(block),
    "the playable fallback must still require a ready YouTube id",
  );
});

// ── 3. The gate itself must still exist on the primary path ────────────────
test("the primary Time Slice query still gates on YouTube", () => {
  assert.ok(
    /sql \+= youtubeGate/.test(src),
    "the primary query must apply the YouTube gate for heardle",
  );
});

// ── 4. The real catalogue must have enough playable songs ─────────────────
// If the gate could not be satisfied the fix would just hide the symptom.
test("the catalogue has enough YouTube-ready songs to play", () => {
  const out = execFileSync(
    "python3",
    [
      "-c",
      `import sqlite3, json
db = sqlite3.connect(${JSON.stringify(
        path.join(__dirname, "..", "data", "tebak_lagu.db"),
      )})
tot = db.execute("select count(*) from songs").fetchone()[0]
rdy = db.execute("select count(*) from songs where youtube_status='ready' and youtube_id is not null").fetchone()[0]
print(json.dumps({"total": tot, "ready": rdy}))`,
    ],
    { encoding: "utf8" },
  );
  const { total, ready } = JSON.parse(out);
  assert.ok(ready > 0, "catalogue has no playable songs at all");
  assert.ok(
    ready / total > 0.8,
    `only ${ready}/${total} songs are playable; the gate would starve Time Slice`,
  );
});

// ── 5. Unplayable rows exist, so the leak was reachable ───────────────────
// If nothing were unplayable the regression test could not have failed before.
test("unplayable rows exist, so this regression was reachable", () => {
  const out = execFileSync(
    "python3",
    [
      "-c",
      `import sqlite3, json
db = sqlite3.connect(${JSON.stringify(
        path.join(__dirname, "..", "data", "tebak_lagu.db"),
      )})
bad = db.execute("select count(*) from songs where youtube_id is null or youtube_status is null or youtube_status != 'ready'").fetchone()[0]
print(json.dumps({"bad": bad}))`,
    ],
    { encoding: "utf8" },
  );
  const { bad } = JSON.parse(out);
  assert.ok(bad > 0, "expected unplayable rows to exist in the catalogue");
});

// ── report ─────────────────────────────────────────────────────────────────
let failed = 0;
for (const c of checks) {
  if (c.ok) console.log(`  ok   ${c.name}`);
  else {
    failed++;
    console.log(`  FAIL ${c.name}\n         ${c.err}`);
  }
}
console.log(
  failed === 0
    ? `heardle-playable-pool: all ${checks.length} assertions passed`
    : `heardle-playable-pool: ${failed}/${checks.length} FAILED`,
);
process.exit(failed === 0 ? 0 : 1);