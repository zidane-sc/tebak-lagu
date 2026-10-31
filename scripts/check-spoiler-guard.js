/**
 * Regression check for "the song title still shows up in the notification".
 *
 * The OS notification / lock screen / media panel is fed by Media Session
 * metadata, which a playing <audio> or the YouTube iframe publishes on its own.
 * The page's own title is a second channel (tab label, task switcher).
 *
 * The old defence polled on an interval, which cannot win a race against a
 * publisher that can write whenever it likes — the notification could still
 * appear in the gap. Now the guard clears synchronously at every playback start
 * and the poll is only a backstop. These assertions cover both channels and
 * every audio start site.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "src");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

const guard = read("lib", "spoiler-guard.ts");
const engine = read("lib", "youtube-engine.ts");
const multi = read("app", "multiplayer", "page.tsx");
const tts = read("components", "modes", "TtsModePlayer.tsx");
const gameOver = read("components", "GameOverModal.tsx");

const checks = [];
const test = (name, fn) => {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (e) {
    checks.push({ name, ok: false, err: e.message });
  }
};

// ── 1. Both leak channels are cleared ───────────────────────────────────────
test("Media Session metadata is overwritten, not nulled", () => {
  // Nulling does not retract an already-shown notification on iOS, so the guard
  // publishes a placeholder instead. See writeDecoyMetadata.
  assert.ok(
    /new MediaMetadata\(\{/.test(guard),
    "a placeholder MediaMetadata must be published",
  );
  assert.ok(
    !/ms\.metadata\s*=\s*null/.test(guard),
    "metadata must never be assigned null — that is the iOS leak",
  );
  assert.ok(
    !/if\s*\(\s*ms\.metadata\s*\)/.test(guard),
    "metadata assignment must never be gated on ms.metadata existing (it starts null)",
  );
  assert.ok(
    /ms\.playbackState\s*=\s*"none"/.test(guard),
    "playbackState must be reset to none, which is what drops the panel",
  );
});

test("the placeholder carries no track identity", () => {
  // The player only ever receives a video id and an offset, so a placeholder
  // built from constants cannot leak anything.
  const start = guard.indexOf("function writeDecoyMetadata");
  const body = guard.slice(start, guard.indexOf("} catch", start));
  assert.ok(/title:\s*BASE_TITLE/.test(body), "title must be the constant");
  assert.ok(
    !/song\./.test(body),
    "placeholder must not interpolate any song field",
  );
});

test("the media action handlers are dropped too", () => {
  // Leaving artwork handlers in place makes Android render a cover image.
  assert.ok(/setActionHandler\(a,\s*null\)/.test(guard), "handlers must be nulled");
  for (const a of ["play", "pause", "nexttrack", "previoustrack", "stop"]) {
    assert.ok(guard.includes(`"${a}"`), `handler ${a} must be dropped`);
  }
});

test("document.title is pinned back to the base title", () => {
  assert.ok(
    /document\.title\s*!==\s*BASE_TITLE[\s\S]{0,80}document\.title\s*=\s*BASE_TITLE/.test(
      guard,
    ),
    "title must be reset when it drifts",
  );
});

test("iframe title attributes are sanitized to prevent media controller leaks", () => {
  assert.ok(
    /iframe\.title\s*!==\s*BASE_TITLE[\s\S]{0,80}iframe\.title\s*=\s*BASE_TITLE/.test(
      guard,
    ),
    "iframe title must be sanitized to the neutral placeholder",
  );
  assert.ok(
    /new MutationObserver/.test(guard),
    "a MutationObserver must be active to catch dynamic iframe title rewrites",
  );
});

// ── 2. The guard must run at every playback start, not only on a timer ──────
test("the YouTube engine clears the guard at every play path", () => {
  const playPaths = (engine.match(/playVideo\(\)/g) || []).length;
  const guards = (engine.match(/guardPlayback\(\)/g) || []).length;
  assert.ok(
    playPaths >= 3,
    `expected several play paths in the engine, found ${playPaths}`,
  );
  assert.ok(
    guards >= 3,
    `every playVideo() path must call guardPlayback(); found ${guards} guards for ${playPaths} plays`,
  );
});

test("the multiplayer <audio> start clears the guard", () => {
  // Solo has no <audio>.play() of its own: its audio goes through the YouTube
  // engine and the game-over modal, both guarded elsewhere. Multiplayer drives
  // a plain <audio> element directly, so it must guard at the call site.
  assert.ok(/guardPlayback\(\)/.test(multi), "multiplayer must guard playback");
  assert.ok(
    /\.play\(\)/.test(multi),
    "sanity: multiplayer really does call play() on its own element",
  );
});

test("the TTS player clears the guard", () => {
  assert.ok(
    /guardPlayback\(\)/.test(tts),
    "TtsModePlayer has no mediaSession guard of its own and must call it",
  );
});

// ── 3. The backstop poll must exist but not be the only defence ────────────
test("a backstop poll still runs for cross-origin republication", () => {
  assert.ok(
    /setInterval\(clearSpoilers/.test(guard),
    "the sweep must remain, since the iframe republishes on its own schedule",
  );
  // The poll must be module-level and shared, not one timer per mounted engine.
  assert.ok(
    /let pollHandle/.test(guard),
    "the poll handle must be module-scoped so N components share one timer",
  );
});

// ── 4. The game-over modal guards its own autoplay ─────────────────────────
test("GameOverModal guards its autoplay audio element", () => {
  assert.ok(
    /startSpoilerGuard\(\)/.test(gameOver),
    "the modal mounts after the engine and must arm the guard itself",
  );
  assert.ok(
    /<audio[^>]*autoPlay/.test(gameOver),
    "sanity: the modal really does autoplay audio",
  );
});

// ── 5. The engine must delegate rather than keep its own copy ──────────────
test("the engine no longer carries a duplicate guard implementation", () => {
  assert.ok(
    !/navigator\.mediaSession/.test(engine),
    "engine must delegate to the shared guard, not duplicate it",
  );
  assert.ok(
    /from "@\/lib\/spoiler-guard"/.test(engine),
    "engine must import the shared guard",
  );
});

// ── 6. No audio start site may be left unguarded ───────────────────────────
test("every component with a play() call also guards it", () => {
  const sites = [
    ["components/modes/TtsModePlayer.tsx", tts],
    ["app/multiplayer/page.tsx", multi],
  ];
  for (const [name, src] of sites) {
    const plays = (src.match(/\.play\(\)/g) || []).length;
    if (plays === 0) continue;
    assert.ok(
      /spoiler-guard/.test(src),
      `${name} plays audio but never touches the spoiler guard`,
    );
  }
});

test("top-frame media session anchor exists to override cross-origin iframe routing", () => {
  assert.ok(
    /export function anchorMediaSession/.test(guard),
    "anchorMediaSession must be exported to claim media focus in top frame",
  );
  assert.ok(
    /export function releaseMediaSession/.test(guard),
    "releaseMediaSession must be exported to release media focus",
  );
  assert.ok(
    /anchorMediaSession/.test(read("components", "modes", "HeardleModePlayer.tsx")),
    "HeardleModePlayer must anchor media session on play",
  );
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
    ? `spoiler-guard: all ${checks.length} assertions passed`
    : `spoiler-guard: ${failed}/${checks.length} FAILED`,
);
process.exit(failed === 0 ? 0 : 1);