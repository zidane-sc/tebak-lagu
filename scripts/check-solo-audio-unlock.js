/**
 * Regression check for "iPhone: Time Slice has no audio".
 *
 * Time Slice playback is YouTube-only (youtube_id). The iframe is a separate
 * document that does not inherit the parent page's autoplay permission, so the
 * only thing that made iOS silent was that nothing in the solo page ever burned
 * a user gesture before the YouTube player was asked to unmute.
 *
 * Two defects, both asserted structurally. No preview-clip path here on purpose:
 * preview_url is a game-over-screen extra, not gameplay audio.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src", "app", "play", "[mode]", "page.tsx");
const playSrc = fs.readFileSync(SRC, "utf8");

const checks = [];
const test = (name, fn) => {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (e) {
    checks.push({ name, ok: false, err: e.message });
  }
};

// ── 1. Solo page must burn a gesture to unlock audio ───────────────────────
// iOS only permits unmuted playback after a real gesture in the same document.
// The YouTube iframe is a different document and inherits nothing, so without
// this the first Play press seeks and unmutes into a player that stays muted.
test("solo page unlocks the audio context on a user gesture", () => {
  assert.ok(
    /AudioContext|webkitAudioContext/.test(playSrc),
    "solo page must create an AudioContext",
  );
  for (const ev of ["pointerdown", "touchstart", "keydown", "click"]) {
    assert.ok(playSrc.includes(`"${ev}"`), `unlock must listen for ${ev}`);
  }
  assert.ok(
    /addEventListener\(\s*e\s*,\s*unlock\s*,\s*\{\s*once:\s*true/.test(playSrc),
    "unlock must be bound with once:true so it fires on the first gesture only",
  );
  // A gain of 0 keeps the unlock inaudible.
  assert.ok(/gain\.gain\.value\s*=\s*0/.test(playSrc), "unlock must be silent");
});

// ── 2. unmuteAndPlay must not run against an unloaded player ───────────────
// unmuteAndPlay only seeks and unmutes an already-loaded video. On a fresh
// round nothing is loaded, so it was a silent no-op.
test("unmuteAndPlay is guarded by a loaded-song check", () => {
  assert.ok(
    /if\s*\(\s*ytEngine\.currentSong\s*\)/.test(playSrc),
    "unmuteAndPlay must sit behind `if (ytEngine.currentSong)`",
  );
});

// ── 3. The YouTube path must stay the only playback source ─────────────────
// Guards against reintroducing a second, half-working audio path. preview_url
// is for the game-over screen only.
test("no preview-clip audio path was reintroduced into gameplay", () => {
  assert.ok(
    !/<audio\s+ref=\{fallbackAudioRef\}/.test(playSrc),
    "Time Slice must not grow a fallback <audio> gameplay element",
  );
  assert.ok(
    !/fallbackPreviewUrl=/.test(playSrc),
    "Time Slice must not pass a fallback preview to the player",
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
    ? `solo-audio-unlock: all ${checks.length} assertions passed`
    : `solo-audio-unlock: ${failed}/${checks.length} FAILED`,
);
process.exit(failed === 0 ? 0 : 1);