/**
 * Regression check for "iPhone: Time Slice has no audio".
 *
 * Solo Time Slice routes all playback through the YouTube iframe. Three separate
 * things could leave a round silent, and only the button press is a user
 * gesture — so each one is asserted structurally here.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src", "app", "play", "[mode]", "page.tsx");
const PLAYER = path.join(__dirname, "..", "src", "components", "modes", "HeardleModePlayer.tsx");

const playSrc = fs.readFileSync(SRC, "utf8");
const playerSrc = fs.readFileSync(PLAYER, "utf8");

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
// iOS only allows unmuted playback after a real gesture in the same document.
// The YouTube iframe is a different document and inherits nothing, so without
// this the first Play press is silently muted.
test("solo page unlocks the audio context on a user gesture", () => {
  assert.ok(
    /AudioContext|webkitAudioContext/.test(playSrc),
    "solo page must create an AudioContext",
  );
  assert.ok(
    /addEventListener\(\s*e\s*,\s*unlock\s*,\s*\{\s*once:\s*true/.test(playSrc),
    "unlock must be bound with once:true so it fires on the first gesture only",
  );
  for (const ev of ["pointerdown", "touchstart", "keydown", "click"]) {
    assert.ok(
      playSrc.includes(`"${ev}"`),
      `unlock must listen for ${ev}`,
    );
  }
  // A gain of 0 keeps the unlock inaudible; anything higher is a bug.
  assert.ok(/gain\.gain\.value\s*=\s*0/.test(playSrc), "unlock must be silent");
});

// ── 2. unmuteAndPlay must not be called on an unloaded player ─────────────
// unmuteAndPlay only seeks/unmutes what is already loaded. On a fresh round
// there is nothing loaded, so it was a no-op and the round came out silent.
test("unmuteAndPlay is guarded by a loaded-song check", () => {
  const guarded = /if\s*\(\s*ytEngine\.currentSong\s*\)\s*\{?\s*\n?\s*ytEngine\.unmuteAndPlay\(/.test(
    playSrc,
  );
  assert.ok(
    guarded,
    "unmuteAndPlay must be behind `if (ytEngine.currentSong)`",
  );
});

// ── 3. A playable source must exist even without YouTube ───────────────────
// canPlay used to require youtubeStatus === "ready", so a refused embed left a
// dead button: nothing happens when pressed.
test("play button stays usable when YouTube is unavailable", () => {
  assert.ok(
    /const\s+hasYoutube\s*=/.test(playerSrc),
    "player must distinguish the YouTube source",
  );
  assert.ok(
    /const\s+canPlay\s*=\s*hasYoutube\s*\|\|\s*hasFallback/.test(playerSrc),
    "canPlay must include the fallback source",
  );
});

// ── 4. The fallback must actually be wired from the page ───────────────────
test("fallback preview is passed to the player and can play", () => {
  assert.ok(/fallbackPreviewUrl=\{previewUrl\}/.test(playSrc), "previewUrl must be passed");
  assert.ok(/onFallbackPlay=\{/.test(playSrc), "onFallbackPlay must be passed");
  assert.ok(/onFallbackPause=\{/.test(playSrc), "onFallbackPause must be passed");
  assert.ok(/fallbackAudioRef/.test(playSrc), "page must own an audio element ref");
});

// ── 5. The audio element must actually be mounted ─────────────────────────
// The ref is useless if no <audio> exists in the tree.
test("the preview audio element is rendered", () => {
  assert.ok(
    /<audio\s+ref=\{fallbackAudioRef\}/.test(playSrc),
    "an <audio> element bound to fallbackAudioRef must be rendered",
  );
});

// ── 6. A refused embed must not look like a dead end ───────────────────────
// Errors 101/150 are runtime refusals; the old UI only showed the raw
// "unavailable" state and offered no alternative.
test("a refused embed falls back instead of showing a dead button", () => {
  assert.ok(
    /const\s+useFallback\s*=\s*!hasYoutube/.test(playerSrc),
    "player must choose the fallback when there is no YouTube source",
  );
  assert.ok(
    /onFallbackPlay!\(fallbackStartSecond/.test(playerSrc),
    "fallback start must call onFallbackPlay",
  );
  assert.ok(
    /ytEngineState === "unavailable" && !hasFallback/.test(playerSrc),
    "the dead-end message must be suppressed when a fallback exists",
  );
});

// ── 7. Fallback choice must not leak into the next round ───────────────────
test("the fallback source resets for the next song", () => {
  assert.ok(
    /setUsingFallback\(false\)/.test(playerSrc),
    "usingFallback must reset on a new song",
  );
  assert.ok(
    /setUsingFallback\(false\)/.test(playerSrc) &&
      /\[\s*searchQuery\s*\]/.test(playerSrc),
    "the reset must be keyed to the song",
  );
});

// ── 8. The offset must be clamped so it cannot read past the clip end ──────
test("preview offset is clamped inside the clip", () => {
  assert.ok(
    /Math\.max\(\s*0\s*,\s*Math\.min\(\s*startSecond\s*,\s*\d+\s*\)\s*\)/.test(playSrc),
    "preview currentTime must be clamped to a valid range",
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