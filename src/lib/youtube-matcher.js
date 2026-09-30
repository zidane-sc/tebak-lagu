/**
 * Shared YouTube candidate matching.
 *
 * ponytail: one file, because three callers disagreed — the batch worker scored
 * first-word title matches and happily accepted a [Jengi Remix], the admin
 * picker had a separate and narrower noise list, and a 200-song run turned up a
 * 90-minute compilation whose title contained the song name. A wrong video id
 * makes the game display the right title while playing a different recording,
 * so all paths need the same rejection rules.
 *
 * Written as CommonJS so the batch worker, the admin route handler and the
 * assert-based self-check can all load it.
 */

const OFFICIAL_KEYWORDS = [
  "official audio", "official video", "official mv", "official music video", "vevo",
  "sony music", "warner music", "universal music", "musica studio", "gp records",
  "nagaswara", "hits records", "indie pop",
];

/**
 * Uploads that are not the original recording. These play differently from the
 * studio track, so accepting one turns a fair guess into an unanswerable one.
 *
 * `remaster` is here because a 2002 digital remaster is a re-rendered master,
 * and `piano version` because both passed the original pattern during a
 * 200-song run. `edit` covers single edits, `album` catches compilations that
 * are labelled as such.
 */
const NON_ORIGINAL =
  /\b(remix|rework|bootleg|mashup|flip|cover|tribute|cover\s*band|live|instrumental|acoustic|a\s*capella|karaoke|nightcore|night\s*core|slowed|sped\s*up|8d|reverb|piano\s*version|piano\s*cover|demo|remaster(?:ed)?(?:\s*20\d\d)?|digits?\s*on|edit)\b/i;

/** Compilations, live albums and lyric compilations. */
const COMPILATION =
  /\b(compilation|greatest\s*hits|best\s*of|love\s*songs|playlist|full\s*album|album\s*\d|various\s*artists|megamix|non\s*stop)\b/i;

/** A track, not a mix. Anything longer is almost certainly a compilation. */
const MAX_TRACK_SECONDS = 12 * 60;

/** Strip credits and tags: "Title (feat. X) [Official Video]" -> "title official video". */
function normalizeTitle(s) {
  return (s || "")
    .toLowerCase()
    .replace(/\(.*?\)|\[[^\]]*\]/g, " ")
    .replace(/[–—\-_]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Share of the database title's words that appear in the upload title.
 * Note this is deliberately not a substring test: "Hello" is a substring of
 * "Hello Kitty Theme", so a substring check cannot tell two songs apart.
 * It also cannot catch a compilation that happens to contain the title, which
 * is what isDurationPlausible() covers.
 */
function titleOverlap(want, got) {
  const w = normalizeTitle(want).split(" ");
  const g = new Set(normalizeTitle(got).split(" "));
  if (w.length === 0) return 0;
  return w.filter((t) => g.has(t)).length / w.length;
}

/** Parse "3:45", "1:02:03" or "3 min" into seconds. Null when unparseable. */
function parseDuration(duration) {
  if (duration == null) return null;
  const s = String(duration).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  const clock = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (clock) {
    const [, h, m, sec] = clock;
    return (h ? Number(h) * 3600 : 0) + Number(m) * 60 + Number(sec);
  }
  const mins = s.match(/^(\d+)\s*min/i);
  if (mins) return Number(mins[1]) * 60;
  return null;
}

/**
 * For short titles the overlap test is nearly meaningless: a song called "Ah"
 * or "Kekal" overlaps 100% with any upload containing that word, so the wrong
 * artist's song passes. 308 of the catalogue's ready songs have single-word
 * titles, so this is not a corner case.
 *
 * Requiring the artist's name in the upload title is the signal that survives:
 * a one-word title still has to be attached to the right artist. Only applied
 * when the title is a single short token — for a full title the existing
 * overlap check is stronger than an artist-name guess.
 */
const SHORT_TITLE_MAX_CHARS = 8;

function needsArtistCheck(title) {
  const t = normalizeTitle(title);
  if (!t) return false;
  return t.length <= SHORT_TITLE_MAX_CHARS || !t.includes(" ");
}

function artistMatches(candidate, artist) {
  const a = normalizeTitle(artist);
  if (!a) return true;
  const hay = normalizeTitle(`${candidate.title || ""} ${candidate.channel || ""}`);
  return a.split(" ").some((tok) => tok.length > 2 && hay.includes(tok));
}

function isNonOriginal(candidate) {
  return NON_ORIGINAL.test(`${candidate.title || ""} ${candidate.channel || ""}`);
}

function isCompilation(candidate) {
  return COMPILATION.test(`${candidate.title || ""} ${candidate.channel || ""}`);
}

/**
 * Reject anything too long to be a single track. A title can contain the song
 * name and still be a 90-minute compilation — "Gagal Move On Di Lagu VIRGOUN |
 * Virgoun's Most Devastating Love Songs" was accepted on a title match alone.
 * An unknown duration is allowed: YouTube omits the field often enough that
 * refusing on absence would throw away most good matches.
 */
function isDurationPlausible(candidate) {
  const seconds = parseDuration(candidate.duration);
  if (seconds === null) return true;
  return seconds > 0 && seconds <= MAX_TRACK_SECONDS;
}

/** Batch-worker score. Higher is better; below MIN_SCORE means reject. */
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

const MIN_SCORE = 30;
const MIN_OVERLAP = 0.75;

/** True when the candidate is safe to write to the database as-is. */
function isAcceptable(candidate, artist, title) {
  if (!candidate?.videoId) return false;
  if (scoreResult(candidate, artist, title) < MIN_SCORE) return false;
  if (isNonOriginal(candidate)) return false;
  if (isCompilation(candidate)) return false;
  if (!isDurationPlausible(candidate)) return false;
  if (titleOverlap(title, candidate.title) < MIN_OVERLAP) return false;
  // A one-word title overlaps anything, so require the artist to appear too.
  if (needsArtistCheck(title) && !artistMatches(candidate, artist)) return false;
  return true;
}

module.exports = {
  OFFICIAL_KEYWORDS,
  NON_ORIGINAL,
  COMPILATION,
  MIN_SCORE,
  MIN_OVERLAP,
  MAX_TRACK_SECONDS,
  normalizeTitle,
  titleOverlap,
  parseDuration,
  isNonOriginal,
  isCompilation,
  needsArtistCheck,
  artistMatches,
  isDurationPlausible,
  scoreResult,
  isAcceptable,
};
