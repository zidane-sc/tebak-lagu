// Scoring self-check for the YouTube resolver. Run:
//   node scripts/check-yt-scoring.js
//
// A wrong video id is worse than a missing one: the game displays the right
// title while playing a different recording. These assertions pin the
// rejection rules in src/lib/youtube-matcher.js, which the batch worker and
// the admin picker both use.
const assert = require("assert");
const {
  scoreResult, titleOverlap, parseDuration, isNonOriginal, isCompilation,
  isDurationPlausible, isAcceptable, needsArtistCheck, artistMatches,
  MIN_OVERLAP, MAX_TRACK_SECONDS,
} = require("../src/lib/youtube-matcher.js");

const t = (title, channel, duration) => ({ title, channel, duration, videoId: "xxxxxxxxxxx" });

// 1. The remix that slipped through at score 50 must be rejected.
assert.strictEqual(
  isAcceptable(t("Summer Feelings (feat. Charlie Puth) [Jengi Remix]", "Lennon Stella", "3:52"),
               "Lennon Stella", "Summer Feelings (feat. Charlie Puth)"),
  false, "a remix must not be accepted as the master");

// 2. Genuine official uploads still pass.
const genuine = [
  ["Timbaland - Carry Out (Official Music Video) ft. Justin Timberlake", "Timbaland", "3:38", "Timbaland", "Carry Out (feat. Justin Timberlake)"],
  ["Gabby Barrett - I Hope (Official Music Video)", "Gabby Barrett", "3:32", "Gabby Barrett", "I Hope (feat. Charlie Puth)"],
  ["Clean Bandit & Topic - Drive (feat. Wes Nelson) [Official Video]", "Clean Bandit & Topic", "3:30", "Clean Bandit & Topic", "Drive (feat. Wes Nelson)"],
  ["Dewa 19 - Kangen (Official Music Video)", "Dewa 19", "4:12", "Dewa 19", "Kangen (feat. Didi Kempot)"],
  ["BTS (방탄소년단) 'Make It Right (feat. Lauv)' Official MV", "HYBE LABELS", "3:50", "BTS", "Make It Right (feat. Lauv)"],
  ["Monita Tahalea - 168 (Official Audio)", "Monita Tahalea", "3:31", "Monita Tahalea", "168"],
  ["Jamrud - Sugali (Official Audio)", "Jamrud Musica", "4:01", "Jamrud", "Sugali"],
];
for (const [ytTitle, channel, dur, artist, title] of genuine) {
  assert.strictEqual(isAcceptable(t(ytTitle, channel, dur), artist, title), true,
    `official upload must be accepted: ${ytTitle}`);
  assert.strictEqual(isNonOriginal(t(ytTitle, channel, dur)), false,
    `official upload must not be flagged non-original: ${ytTitle}`);
}

// 3. Weak matches stay out: a random upload with no channel/keyword signal.
assert.ok(scoreResult(t("Summer Feelings Lyrical Video", "randomchannel99", "3:40"), "Lennon Stella", "Summer Feelings") < 30,
  "a lyrical video with no official signal must fall under the threshold");

// 4. Non-original uploads are rejected regardless of score.
for (const bad of [
  "Summer Feelings (Cover by SomeGuy)", "Summer Feelings Live at Java Rockin' Land",
  "Summer Feelings (Karaoke Version)", "Summer Feelings (Slowed + Reverb)",
  "Summer Feelings (Acoustic Cover)", "Summer Feelings Nightcore",
  "Summer Feelings (Jengkoki Remix)", "Summer Feelings (Flip Version)",
  "Summer Feelings 8D Audio", "Summer Feelings (Instrumental)",
  "Summer Feelings (2002 Digital Remaster)", "Summer Feelings (Piano Version)",
  "Summer Feelings (Single Edit)", "Summer Feelings (Remastered 2011)",
]) {
  assert.strictEqual(isNonOriginal(t(bad, "Lennon Stella", "3:30")), true, `"${bad}" must be rejected`);
}

// 5. Compilations and long uploads are rejected on duration even when the
//    title contains the song name — this is what let a 90-minute "Love Songs"
//    collection through on a title match.
const comp = t("Gagal Move On Di Lagu VIRGOUN | Virgoun's Most Devastating Love Songs", "Virgoun", "1:12:44");
assert.strictEqual(isCompilation(comp), true, "a love-songs compilation must be flagged");
assert.strictEqual(isDurationPlausible(comp), false, "a 72-minute upload is not a single track");
assert.strictEqual(isAcceptable(comp, "Virgoun", "Move On"), false, "a compilation must never be accepted");
assert.ok(MAX_TRACK_SECONDS >= 11 * 60, "a long radio edit must stay acceptable");
assert.strictEqual(isDurationPlausible(t("Song", "Channel", "11:30")), true, "11:30 is within the cap");

// 6. Duration parsing, including the formats YouTube actually returns.
assert.strictEqual(parseDuration("3:45"), 225);
assert.strictEqual(parseDuration("1:02:03"), 3723);
assert.strictEqual(parseDuration("3 min"), 180);
assert.strictEqual(parseDuration(""), null);
assert.strictEqual(parseDuration(undefined), null);
assert.strictEqual(parseDuration("LIVE"), null);
// An unknown duration must not be treated as a rejection: YouTube omits it often.
assert.strictEqual(isDurationPlausible(t("Song", "Channel", "")), true, "unknown duration must stay acceptable");
assert.strictEqual(isDurationPlausible(t("Song", "Channel", "0:00")), false, "a zero-length upload is not playable");

// 7. An unrelated upload fails the title check, not just the score.
const unrelated = t("Winter Nights (Piano Cover)", "Lo-Fi Channel", "3:20");
assert.ok(titleOverlap("Hello", unrelated.title) < MIN_OVERLAP, "an unrelated upload must fail the title overlap");
assert.strictEqual(isAcceptable(unrelated, "Adele", "Hello"), false);

// 8. Feat. credits in the DB title are stripped, not treated as a mismatch.
assert.strictEqual(titleOverlap("Kangen (feat. Didi Kempot)", "Kangen"), 1,
  "parenthetical credits must not break the title overlap");

// 9. A candidate with no video id is never acceptable.
assert.strictEqual(isAcceptable({ title: "Kangen", channel: "Dewa 19", duration: "4:12" }, "Dewa 19", "Kangen"), false,
  "a candidate without a video id must be rejected");


// 10. The selection loop, not just the gate. The highest-scoring candidate is
//     often a lyric-only upload; a good official video in second place must
//     still be found. Pinned here because the worker used to judge only
//     scored[0] and reported "not found" for songs that had a correct upload.
function pickAcceptable(candidates, artist, title) {
  return candidates.find((c) => isAcceptable(c, artist, title)) || null;
}
const pool = [
  { title: "Andmesh Kamaleng - Jangan Rubah Takdirku (Lirik)", channel: "Happy Sing", duration: "3:53", videoId: "a" },
  { title: "Andmesh Kamaleng - Jangan Rubah Takdirku (Official Music Video)", channel: "HITS Records", duration: "4:09", videoId: "b" },
  { title: "Judika ft Andmesh - Jangan rubah takdirku (Live Version)", channel: "Kamaleng Music", duration: "4:30", videoId: "c" },
];
const picked = pickAcceptable(pool, "Andmesh", "Jangan Rubah Takdirku");
assert.ok(picked, "a valid candidate in second place must still be selected");
assert.strictEqual(picked.videoId, "b", "must pick the official video, not the lyric upload or the live cut");
assert.strictEqual(pickAcceptable(pool.slice(0, 1), "Andmesh", "Jangan Rubah Takdirku"), null,
  "when only a lyric upload exists, return nothing rather than a wrong id");


// 11. Short titles need an artist check. "Bento" by Iwan Fals was resolved to
//     SWAMI's "Bento (Visual Concert)" because the one-word title overlaps
//     100% with any upload containing "bento". 308 ready songs have
//     single-word titles, so this class of mistake is not rare.
const wrongArtist = t("SWAMI - Bento (Visual Concert)", "Musica Studios", "3:12");
assert.strictEqual(needsArtistCheck("Bento"), true, "a one-word title needs the artist check");
assert.strictEqual(artistMatches(wrongArtist, "Iwan Fals"), false, "SWAMI's upload must not match Iwan Fals");
assert.strictEqual(isAcceptable(wrongArtist, "Iwan Fals", "Bento"), false,
  "another artist's same-titled song must be rejected");

// The correct one still passes.
const rightArtist = t("Iwan Fals - Bento (Official Music Video)", "Musica Studios", "3:45");
assert.strictEqual(isAcceptable(rightArtist, "Iwan Fals", "Bento"), true,
  "the right artist's upload must still be accepted");

// Short-but-real titles work, including when the artist appears in the channel.
assert.strictEqual(isAcceptable(t("Kekal", "Nadin Amizah - Topic", "3:32"), "Nadin Amizah", "Kekal"), true,
  "a one-word title on the artist's own channel must pass");
assert.strictEqual(isAcceptable(t("Kekal (Official Audio)", "Nadin Amizah", "3:32"), "Nadin Amizah", "Kekal"), true);

// A full title does not need the artist check, so an upload titled only with
// the song name is not rejected for lack of an artist mention.
assert.strictEqual(needsArtistCheck("Aku Ingin Engkau"), false,
  "a multi-word title keeps the stronger overlap check");

console.log("yt-scoring: all 11 groups passed");
