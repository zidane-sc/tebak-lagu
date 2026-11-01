/**
 * Regression check for YouTube embed resilience & self-healing mechanisms.
 *
 * Covers:
 * 1. Broken embed reporting route exists and handles payload properly.
 * 2. HeardleModePlayer exposes self-healing swap button on error.
 * 3. PlayArenaPage wires onError to reporting and skip callback.
 * 4. Audit script checks oEmbed status codes and replacement logic.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

const reportRoute = read("src", "app", "api", "songs", "report-broken", "route.ts");
const heardlePlayer = read("src", "components", "modes", "HeardleModePlayer.tsx");
const playPage = read("src", "app", "play", "[mode]", "page.tsx");
const auditScript = read("scripts", "audit-youtube-embeds.js");

const checks = [];
const test = (name, fn) => {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (e) {
    checks.push({ name, ok: false, err: e.message });
  }
};

// ── 1. Reporting API ────────────────────────────────────────────────────────
test("report-broken API endpoint exists and handles error codes", () => {
  assert.ok(/export async function POST/.test(reportRoute), "POST handler must be exported");
  assert.ok(
    /UPDATE songs\s+SET youtube_status = \?/.test(reportRoute),
    "route must update youtube_status in DB"
  );
  assert.ok(
    /embed_disabled/.test(reportRoute),
    "route must set status to embed_disabled"
  );
  assert.ok(
    /not_found/.test(reportRoute),
    "route must set status to not_found for code 100"
  );
});

// ── 2. In-game UX Resilience ────────────────────────────────────────────────
test("HeardleModePlayer renders self-healing swap button on error", () => {
  assert.ok(
    /isBrokenSong\?: boolean/.test(heardlePlayer),
    "props must accept isBrokenSong flag"
  );
  assert.ok(
    /onSkipBrokenSong\?: \(\) => void/.test(heardlePlayer),
    "props must accept onSkipBrokenSong callback"
  );
  assert.ok(
    /Ganti Lagu ↻/.test(heardlePlayer),
    "component must render a 1-click Ganti Lagu swap button"
  );
});

test("PlayArenaPage wires engine error to reporting and skip callback", () => {
  assert.ok(
    /\/api\/songs\/report-broken/.test(playPage),
    "page must report broken songs to the API"
  );
  assert.ok(
    /handleSkipBrokenSong/.test(playPage),
    "page must define a skip handler"
  );
  assert.ok(
    /onSkipBrokenSong=\{handleSkipBrokenSong\}/.test(playPage),
    "skip handler must be passed to HeardleModePlayer"
  );
});

// ── 3. Offline Audit Script ────────────────────────────────────────────────
test("audit-youtube-embeds checks oEmbed and supports auto-fix", () => {
  assert.ok(
    /youtube\.com\/oembed/.test(auditScript),
    "audit script must query the official oEmbed API"
  );
  assert.ok(
    /status === 401/.test(auditScript),
    "script must distinguish HTTP 401 (embed disabled)"
  );
  assert.ok(
    /status === 404/.test(auditScript),
    "script must distinguish HTTP 404 (deleted/private)"
  );
  assert.ok(
    /findEmbeddableAlternative/.test(auditScript),
    "script must support finding an embeddable alternative"
  );
});

// ── Report ──────────────────────────────────────────────────────────────────
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
    ? `embed-self-healing: all ${checks.length} assertions passed`
    : `embed-self-healing: ${failed}/${checks.length} FAILED`
);
process.exit(failed === 0 ? 0 : 1);
