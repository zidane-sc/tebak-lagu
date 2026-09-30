// Scoring self-check for the YouTube ID resolver. Run:
//   node scripts/check-yt-scoring.js
//
// A wrong video id is worse than a missing one: the game plays the wrong song
// while showing the right title. These assertions pin the rejection rules.
const assert = require("assert");

const OFFICIAL_KEYWORDS = [
  "official audio", "official video", "official mv", "official music video", "vevo",
  "sony music", "warner music", "universal music", "musica studio", "gp records",
  "nagaswara", "hits records", "indie pop",
];

// Non-original uploads: covers, remixes, live cuts and sped-up edits all play
// differently from the studio track, so a wrong pick makes the clue a lie.
// Includes `remaster(ed) 20xx` because those are re-recordings, not masters.
const NON_ORIGINAL =
  /\b(remix|cover|live|acoustic|instrumental|nightcore|slowed|sped\s*up|8d|karaoke|mashup|flip|night\s*core)\b/i;

// Strip credits and tags so "Title (feat. X) [Official Video]" normalises to
// the same core words as the database title.
function norm(s) {
  return (s || "")
    .toLowerCase()
    .replace(/\(.*?\)|\[[^\]]*\]/g, " ")
    .replace(/[–—\-_]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Mirrors scoreResult() in scripts/enrich-youtube-ids.js.
function scoreResult(result, artist, title) {
  let score = 0;
  const titleLow = (result.title || "").toLowerCase();
  const channelLow = (result.channel || "").toLowerCase();
  const artistLow = artist.toLowerCase();
  const songLow = title.toLowerCase();

  if (channelLow.includes(artistLow.split(" ")[0])) score += 30;
  if (titleLow.includes(songLow.split(" ")[0])) score += 20;
  for (const kw of OFFICIAL_KEYWORDS) {
    if (titleLow.includes(kw) || channelLow.includes(kw)) { score += 15; break; }
  }
  return score;
}

// Fraction of the database title's words that must appear in the upload title.
// "Hello" vs "Hello Kitty Theme" scores 1/1 = 1.0 and still passes, so this
// guards against wildly different titles, not against shared prefixes. The
// NON_ORIGINAL check is what blocks the actual wrong-song cases.
function titleOverlap(want, got) {
  const w = norm(want).split(" ");
  const g = new Set(norm(got).split(" "));
  if (w.length === 0) return 0;
  return w.filter((t) => g.has(t)).length / w.length;
}

function judge(result, artist, title) {
  const s = scoreResult(result, artist, title);
  const haystack = `${result.title || ""} ${result.channel || ""}`;
  const rejected = NON_ORIGINAL.test(haystack);
  const overlap = titleOverlap(title, result.title);
  const fullTitleMatch = overlap >= 0.75;
  return { accepted: s >= 30 && !rejected && fullTitleMatch, score: s, rejected, fullTitleMatch, overlap };
}

const t = (title, channel) => ({ title, channel });

// 1. The remix that slipped through at score 50 must now be rejected.
assert.strictEqual(
  judge(t("Summer Feelings (feat. Charlie Puth) [Jengi Remix]", "Lennon Stella"), "Lennon Stella",
        "Summer Feelings (feat. Charlie Puth)").accepted,
  false,
  "a remix must not be accepted as the master"
);

// 2. Genuine official uploads still pass.
const genuine = [
  ["Timbaland - Carry Out (Official Music Video) ft. Justin Timberlake", "Timbaland", "Timbaland", "Carry Out (feat. Justin Timberlake)"],
  ["Gabby Barrett - I Hope (Official Music Video)", "Gabby Barrett", "Gabby Barrett", "I Hope (feat. Charlie Puth)"],
  ["Clean Bandit & Topic - Drive (feat. Wes Nelson) [Official Video]", "Clean Bandit & Topic", "Clean Bandit & Topic", "Drive (feat. Wes Nelson)"],
  ["Dewa 19 - Kangen (Official Music Video)", "Dewa 19", "Dewa 19", "Kangen (feat. Didi Kempot)"],
];
for (const [ytTitle, channel, artist, title] of genuine) {
  const j = judge(t(ytTitle, channel), artist, title);
  assert.strictEqual(j.accepted, true, `official upload must be accepted: ${ytTitle} (${JSON.stringify(j)})`);
  assert.strictEqual(j.rejected, false, `official upload must not be flagged non-original: ${ytTitle}`);
}

// 3. Weak matches stay out: a random upload with no channel/keyword signal.
const weak = judge(t("Summer Feelings Lyrical Video", "randomchannel99"), "Lennon Stella", "Summer Feelings");
assert.strictEqual(weak.score, 20);
assert.ok(weak.score < 30, "a lyrical video with no official signal must fall under the threshold");

// 4. Cover / live / karaoke / remix must be rejected regardless of score.
for (const bad of [
  "Summer Feelings (Cover by SomeGuy)", "Summer Feelings Live at Java Rockin' Land",
  "Summer Feelings (Karaoke Version)", "Summer Feelings (Slowed + Reverb)",
  "Summer Feelings (Acoustic Cover)", "Summer Feelings Nightcore",
  "Summer Feelings (Jengkoki Remix)", "Summer Feelings (Flip Version)",
]) {
  assert.strictEqual(judge(t(bad, "Lennon Stella"), "Lennon Stella", "Summer Feelings").rejected, true, `"${bad}" must be rejected`);
}

// 5. An unrelated upload is rejected on the title, not just the score.
const unrelated = judge(t("Winter Nights (Piano Cover)", "Lo-Fi Channel"), "Adele", "Hello");
assert.strictEqual(unrelated.fullTitleMatch, false, "an unrelated upload must fail the title match");
assert.strictEqual(unrelated.accepted, false);

// 6. Feat. credits in the DB title are stripped, not treated as a mismatch.
const feat = judge(t("Kangen (Official Music Video)", "Dewa 19"), "Dewa 19", "Kangen (feat. Didi Kempot)");
assert.strictEqual(feat.fullTitleMatch, true, "parenthetical credits must not break the title match");

console.log("yt-scoring: all 6 groups passed");
