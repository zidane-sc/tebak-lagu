/**
 * Artist Parser Engine for Multi-Singer / Multi-Artist Collaborations
 */

const BAND_EXCEPTIONS = new Set([
  "sheila on 7",
  "yovie & nuno",
  "white shoes & the couples company",
  "maliq & d'essentials",
  "earth, wind & fire",
  "simon & garfunkel",
  "boyz ii men",
  "kings of leon",
  "above & beyond",
  "florence + the machine",
  "florence and the machine",
  "mumford & sons",
  "the black eyed peas",
  "black eyed peas",
  "blood, sweat & tears",
  "kool & the gang",
  "shaggydog",
  "the beatles",
  "endank soekamti",
  "padi",
  "slank",
  "dewa 19",
  "the rollies",
  "the changcuters",
  "crosby, stills & nash",
  "crosby, stills, nash & young",
  "twenty one pilots",
  "project pop",
  "ada band",
  "efek rumah kaca",
  "fourtwnty",
  "payung teduh",
  "the adams",
  "the sigit",
  "the upstairs",
  "kahitna",
  "3 pemuda berbahaya",
]);

function slugifyArtist(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanArtistName(name) {
  if (!name) return "";
  return name
    .replace(/^[\s,;&xX]+|[\s,;&xX]+$/g, "")
    .replace(/[\(\[\)\]]/g, "")
    .trim();
}

/**
 * Parses a combined artist string into individual artists with roles.
 * @param {string} rawString e.g. "Adrian Khalif & Bernadya", "Lyodra, Tiara Andini & Ziva Magnolya"
 * @returns {Array<{ id: string, name: string, role: 'primary' | 'featured' | 'duet' }>}
 */
function parseSongArtists(rawString) {
  if (!rawString) return [];
  const trimmed = rawString.trim();
  const lower = trimmed.toLowerCase();

  // 1. If entire string is a known band, don't split
  if (BAND_EXCEPTIONS.has(lower)) {
    return [{ id: slugifyArtist(trimmed), name: trimmed, role: "primary" }];
  }

  // 2. Separate by featured pattern: feat. / ft. / featuring
  let primaryPart = trimmed;
  let featuredPart = "";

  const featMatch = trimmed.match(/(.*?)\s+(?:feat\.|feat|ft\.|ft|featuring)\s+(.*)/i);
  if (featMatch) {
    primaryPart = featMatch[1].trim();
    featuredPart = featMatch[2].trim();
  }

  const artists = [];

  // Helper to split on commas, '&', 'x'
  function splitSegment(str, defaultRole) {
    if (!str) return;

    if (BAND_EXCEPTIONS.has(str.toLowerCase().trim())) {
      const clean = cleanArtistName(str);
      if (clean) artists.push({ id: slugifyArtist(clean), name: clean, role: defaultRole });
      return;
    }

    // Split by comma, or " & ", or " x ", or " duet ", or " with "
    const tokens = str.split(/,|\s+&\s+|\s+[xX]\s+|\s+duet\s+|\s+with\s+/i);
    let index = 0;
    for (let token of tokens) {
      const clean = cleanArtistName(token);
      if (clean && clean.length > 1) {
        // If part is a known band, keep intact
        let role = defaultRole;
        if (defaultRole === "primary" && index > 0) {
          role = "duet";
        }
        artists.push({ id: slugifyArtist(clean), name: clean, role });
        index++;
      }
    }
  }

  splitSegment(primaryPart, "primary");
  if (featuredPart) {
    splitSegment(featuredPart, "featured");
  }

  // Deduplicate
  const seen = new Set();
  const unique = [];
  for (const a of artists) {
    if (!seen.has(a.id)) {
      seen.add(a.id);
      unique.push(a);
    }
  }

  return unique.length > 0
    ? unique
    : [{ id: slugifyArtist(trimmed), name: trimmed, role: "primary" }];
}

module.exports = {
  BAND_EXCEPTIONS,
  slugifyArtist,
  cleanArtistName,
  parseSongArtists,
};
