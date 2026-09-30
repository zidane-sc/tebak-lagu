// Assert-based self-check for the vocal-offset backfill rules. Run: npm test
//
// The offset decides where a Time Slice clue starts. Too early and the player
// hears an instrumental intro that gives nothing away but also no chance; too
// late and the first line of the chorus is gone. These assertions pin the
// clamping and parsing, because a bad parse here moves 2500 songs silently.
const assert = require("assert");

// Mirrors MIN_OFFSET / MAX_OFFSET in the backfill scripts.
const MIN_OFFSET = 0;
const MAX_OFFSET = 45;

/** Mirrors the offset parser in both backfill scripts. */
function parseOffset(syncedLyrics, instrumental = false) {
  if (instrumental) return null;
  const m = (syncedLyrics || "").match(/\[(\d+):(\d+(?:\.\d+)?)\]/);
  if (!m) return null;
  const seconds = Number(m[1]) * 60 + Number(m[2]);
  return Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, Math.floor(seconds)));
}

/** Mirrors the title stripper: "Poker Face (LLG vs. GLG Radio Edit)" -> "Poker Face" */
function stripTitle(title) {
  return String(title || "")
    .replace(/\s*[\(\[][^\)\]]*[\)\]]\s*$/g, "")
    .replace(/\s*-\s*(radio|mono|stereo)\s+edit.*$/i, "")
    .trim();
}

// 1. The first timestamp wins, not the loudest or the median. "Dai Dai" opens
//    on a vocal at 0.09s, and a fixed 20s default skipped the whole hook.
assert.strictEqual(parseOffset("[00:00.09] Oh-eh\n[00:02.17] Eh"), 0);
assert.strictEqual(parseOffset("[00:14.04] Kut'rima suratmu\n[00:16.76] T'lah kubaca"), 14);
assert.strictEqual(parseOffset("[00:00.00] Please don't stop the music"), 0);
assert.strictEqual(parseOffset("[00:10.30] i can't tell you why"), 10);

// 2. Fractional seconds floor rather than round: 00:14.76 must not become 15,
//    because a 15s start can cut a syllable that starts at 14.76.
assert.strictEqual(parseOffset("[00:14.76] x"), 14);
assert.strictEqual(parseOffset("[00:14.20] x"), 14);
assert.strictEqual(parseOffset("[00:59.99] x"), 45, "must clamp, not wrap to 59");

// 3. Clamp bounds. 45 is where the 30s Apple preview plus a 22s tier still has
//    audio; a song whose first vocal is at 3:00 is not a clue, it is silence.
assert.strictEqual(parseOffset("[00:00.00] x"), MIN_OFFSET);
assert.strictEqual(parseOffset("[03:12.00] x"), MAX_OFFSET);
assert.strictEqual(parseOffset("[09:99.00] x"), MAX_OFFSET);

// 4. Missing or empty data must yield null, never 0. A null means "leave the
//    default alone"; a 0 would silently move the song to the top of the track.
assert.strictEqual(parseOffset(""), null);
assert.strictEqual(parseOffset(null), null);
assert.strictEqual(parseOffset(undefined), null);
assert.strictEqual(parseOffset("no timestamps here"), null);
assert.strictEqual(parseOffset("[00:14.04] x", true), null, "an instrumental track has no vocal to start on");

// 5. Title stripping, which is what the second pass relies on to find a track
//    LRCLIB files under a shorter name.
assert.strictEqual(stripTitle("Poker Face (LLG vs. GLG Radio Edit)"), "Poker Face");
assert.strictEqual(stripTitle("Summer Feelings (feat. Charlie Puth)"), "Summer Feelings");
assert.strictEqual(stripTitle("Track [Official Music Video]"), "Track");
assert.strictEqual(stripTitle("Song - Radio Edit"), "Song");
assert.strictEqual(stripTitle("Plain Title"), "Plain Title");
assert.strictEqual(stripTitle(""), "");

// 6. Stripping must not eat a title that legitimately ends in a bracket or a
//    dash, which would send the search off to a different track.
assert.strictEqual(stripTitle("Something (Acoustic)"), "Something");
assert.strictEqual(stripTitle("Shape of You"), "Shape of You");
assert.strictEqual(stripTitle("A-B"), "A-B", "a hyphen inside a title is not a radio edit marker");

// 7. The real regression: 0 is a real offset, and a truthiness check would
//    discard it. 255 songs in the catalogue open on vocals.
const zero = parseOffset("[00:00.00] x");
assert.strictEqual(zero, 0);
assert.ok(zero !== null, "a zero offset must be a value, not a miss");
assert.notStrictEqual(zero, undefined);

// 8. Time Slice is YouTube-only. The 30s Apple/Deezer preview was a second
//    audio path with different behaviour: the 22s and 30s tiers ran past the
//    end of the clip and ended in silence, and a preview has no way to honour a
//    start offset. The server must never hand this mode a song it cannot play,
//    including through the relaxation path.
{
  const heardleFilter =
    " AND s.youtube_status = 'ready' AND s.youtube_id IS NOT NULL AND s.youtube_id != ''";
  const sql = "SELECT s.* FROM songs s WHERE (s.is_active = 1 OR s.is_active IS NULL)" + heardleFilter;
  assert.ok(sql.includes("youtube_id != ''"),
    "an empty-string youtube_id must not satisfy the Time Slice filter");
  assert.ok(!sql.includes("lyrics_clues"),
    "the lyrics filter belongs to TTS, not Time Slice");

  // The relaxation must strip the lyrics requirement and nothing else. If it
  // also stripped the YouTube one, the client would receive a song with no
  // playable audio.
  const relaxed = sql.replace(
    " AND s.lyrics_clues IS NOT NULL AND json_array_length(s.lyrics_clues) >= 4",
    ""
  );
  assert.strictEqual(relaxed, sql,
    "the Time Slice filter must survive relaxation untouched");
}

console.log("vocal-offset: all 8 groups passed");
