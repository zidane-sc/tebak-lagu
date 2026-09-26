#!/usr/bin/env python3
"""
Ultra-Strict Mainstream Curator:
Purges all obscure artists, weird collisions, and non-mainstream tracks from Tebak Lagu.
Leaves ONLY artists that regular Indonesian & Western music trivia players recognize instantly.
"""
import sqlite3
import json
import urllib.request
import re

with open("/home/schomeserver/.hermes/config.yaml") as f:
    text = f.read()
m = re.search(r"api_key:\s*([^\s\n]+)", text)
api_key = m.group(1).strip("\"'") if m else ""

con = sqlite3.connect("data/tebak_lagu.db")
cur = con.cursor()

# 1. First, delete all known inverted band-title collisions
cur.execute("SELECT id, title, artist, category FROM songs;")
all_songs = cur.fetchall()

keyword_bands = {
    "naif", "armada", "geisha", "last child", "god bless", "sore", "nirvana", "scorpions",
    "caffeine", "ello", "bbb", "kotak", "radja", "ungu", "wali", "gigi", "peterpan",
    "seventeen", "dewa", "dewa 19", "slank", "padi", "drive", "matta", "utopia",
    "vagetoz", "republic", "repvblik", "kangen", "kangen band", "hijau daun", "dmasiv",
    "sheila on 7", "kahitna", "ran", "the changcuters", "nidji", "tipe-x", "jamrud",
    "boomerang", "pas band", "superman is dead", "pee wee gaskins", "endank soekamti",
    "fourtwnty", "payung teduh", "barasuara", "efek rumah kaca", "shaggydog", "the adams",
    "the sigit", "the upstairs", "terry", "kristina", "gigi"
}

deleted_collisions = 0
for r in all_songs:
    sid, title, artist, cat = r
    t_clean = title.lower().strip()
    a_clean = artist.lower().strip()
    
    # Exception: Dewa 19 - Kangen, Yura Yunita & Dewa 19 - Kangen, /Rif - Radja
    if t_clean == "kangen" and ("dewa" in a_clean or "yura" in a_clean):
        continue
    if t_clean == "radja" and "/rif" in a_clean:
        continue
        
    if t_clean in keyword_bands and t_clean not in a_clean:
        cur.execute("DELETE FROM songs WHERE id = ?;", (sid,))
        deleted_collisions += 1

print(f"Purged {deleted_collisions} inverted scraper collisions.")
con.commit()

# 2. Get list of distinct artists across all songs
cur.execute("""
    SELECT artist, category, COUNT(*) as cnt, MAX(deezer_rank) as rank 
    FROM songs 
    GROUP BY artist, category 
    ORDER BY category, cnt DESC;
""")
artist_rows = cur.fetchall()
print(f"Total remaining artist-category combinations: {len(artist_rows)}")

# Known definitive elite artists to ALWAYS keep (never ask AI)
DEFINITIVE_ELITE = {
    # Nostalgia & Pop 2000s
    "sheila on 7", "dewa 19", "peterpan", "noah", "gigi", "padi", "ungu", "samsons",
    "kangen band", "d'masiv", "st12", "radja", "ada band", "letto", "j-rocks",
    "vagetoz", "cokelat", "kotak", "kerispatih", "hijau daun", "repvblik", "naff",
    "naif", "ari lasso", "chrisye", "glenn fredly", "marcell", "rio febrian",
    "maliq & d'essentials", "the changcuters", "nidji", "project pop", "yovie & nuno",
    "audy", "bcl", "bunga citra lestari", "rossa", "krisdayanti", "ruth sahanaya",
    "shanty", "agnes monica", "agnez mo", "titi dj", "kahitna", "ran", "geisha",
    "last child", "armada", "matta", "utopia", "drive", "wali", "seventeen", "flanella",
    "white shoes & the couples company", "hivi!", "vierratale", "vierra",
    
    # Galau Hits & Modern Indonesian Pop / Indie
    "tulus", "bernadya", "mahalini", "tiara andini", "lyodra", "ziva magnolya",
    "keisya levronka", "yura yunita", "nadin amizah", "fiersa besari", "pamungkas",
    "kunto aji", "sal priadi", "hindia", "idgitaf", "ghea indrawari", "feby putri",
    "danilla", "budi doremi", "judika", "andmesh", "fabio asher", "nadhif basalamah",
    "arash buana", "raisa", "isyana sarasvati", "rendy pandugo", "afgan", "vidi aldiano",
    "juicy luicy", "ardhito pramono", "rizky febian", "marion jola", "feby putri",
    "monita tahalea", "eva celia", "adhitia sofyan", "teddy adhitya", "gangga",
    "batiga", "theovertunes", "jaz", "virgoun", "hanin dhiya", "chintya gabriella",
    "raissa anggiani", "aziz harun", "anggi marito", "paul partohap", "naya revano",
    
    # Anthem Tongkrongan & Rock & Folk
    "slank", "iwan fals", "ebiet g. ade", "jamrud", "tipe-x", "shaggydog", "pas band",
    "superman is dead", "endank soekamti", "pee wee gaskins", "fourtwnty", "payung teduh",
    "sisitipsi", "jason ranti", "efek rumah kaca", "barasuara", "ntrl", "netral",
    "rocket rockers", "the sigit", "the adams", "the upstairs", "god bless", "sore",
    "edane", "boomerang", "morfem", "dhyo haw", "tony q rastafara", "steven & coconut treez",
    "benyamin s.", "doel sumbang", "/rif",
    
    # Dangdut & Koplo
    "denny caknan", "happy asmara", "guyon waton", "ndarboy genk", "via vallen",
    "nella kharisma", "didi kempot", "rhoma irama", "yeni inka", "ndx aka", "aftershine",
    "hendra kumbara", "cita citata", "ayu ting ting", "siti badriah", "zaskia gotik",
    "meggy z", "mansyur s", "dewi perssik", "fitri carlina", "eny sagita", "safira inema",
    "vita alvia", "lala widy", "tasya rosmala", "difarina indra", "sasya arkhisna",
    "shinta arsinta", "arneta julia", "woro widowati", "ilux id", "om adella", "new pallapa",
    "3 pemuda berbahaya",
    
    # Western Hits Legends & Global Billboard
    "coldplay", "taylor swift", "bruno mars", "ed sheeran", "adele", "queen",
    "maroon 5", "the beatles", "michael jackson", "ariana grande", "justin bieber",
    "rihanna", "eminem", "billie eilish", "linkin park", "paramore", "oasis",
    "green day", "bon jovi", "radiohead", "katy perry", "westlife", "backstreet boys",
    "britney spears", "harry styles", "avril lavigne", "john mayer", "charlie puth",
    "red hot chili peppers", "the killers", "dua lipa", "lady gaga", "shawn mendes",
    "lewis capaldi", "post malone", "the weeknd", "arctic monkeys", "keane",
    "avenged sevenfold", "nirvana", "muse", "alan walker", "chainsmokers", "the chainsmokers",
    "calvin harris", "david guetta", "imagine dragons", "one direction", "shakira",
    "snoop dogg", "dr. dre", "fifty cent", "50 cent", "justin timberlake", "black eyed peas",
    "alicia keys", "beyoncé", "beyonce", "sam smith", "sia", "jason mraz", "james arthur",
    "lukas graham", "calum scott", "kodaline", "dean lewis", "ruel", "lauv", "alessia cara",
    "mariah carey", "whitney houston", "celine dion", "boyz ii men", "bryan adams",
    "scorpions", "guns n' roses", "metallica", "aerosmith", "ac/dc", "u2", "elton john",
    "george michael", "wham!", "bee gees", "abba", "phil collins", "sting", "the police",
    "fleetwood mac", "eagles", "the rolling stones", "pink floyd", "led zeppelin"
}

def is_elite(artist_name):
    low = artist_name.lower().strip()
    for e in DEFINITIVE_ELITE:
        if e in low or low in e:
            return True
    return False

# Group remaining non-elite artists for AI review
to_audit = []
for a in artist_rows:
    artist_name = a[0]
    cat = a[1]
    cnt = a[2]
    rank = a[3]
    if not is_elite(artist_name):
        to_audit.append({"artist": artist_name, "category": cat, "song_count": cnt, "rank": rank})

print(f"Artists explicitly whitelisted as Elite: {len(artist_rows) - len(to_audit)}")
print(f"Artists to audit via Llama 3.3 70B: {len(to_audit)}")

BATCH_SIZE = 35
batches = [to_audit[i:i + BATCH_SIZE] for i in range(0, len(to_audit), BATCH_SIZE)]
to_delete_artists = []

for idx, batch in enumerate(batches):
    prompt = f"""You are a senior music curator for an Indonesian music trivia app.
We want ONLY famous, recognizable, viral, or well-loved music:
- INDONESIAN: Popular pop/indie/rock/dangdut/koplo that ordinary Indonesians know (e.g. Afgan, Raisa, Virgoun, NIKI, Juicy Luicy, Vidi Aldiano, Marion Jola, dll).
- WESTERN: Mainstream Billboard/Spotify hits (e.g. Jason Mraz, Sam Smith, Sia, dll).

Here is a list of candidate artists:
{json.dumps([b['artist'] + ' (' + b['category'] + ')' for b in batch], ensure_ascii=False)}

Identify artists that are OBSCURE, WEIRD, NICHE, RANDOM SCRAPER ACCIDENTS, UNKNOWN INDIE, or FOREIGN SONGS MISTAKENLY PLACED IN INDONESIA.
Examples of obscure artists to DELETE:
- Random foreign names matching words (e.g. "Kizz Daniel", "Iya Terra", "Jairzinho", "Soweto", "Bagarre", "Atzmus", "Faun", "Oum", "Ladytron", "Foreign Air", "Thomston", "Eyedi", "Sapient", "GIMS")
- Minor obscure bands/artists that ordinary people never heard of (e.g. "Angel Du$t", "Bayou", "6 Dogs", "Amaranthe", "Nero", "One Acen", "Magic City Hippies", "Pat Travers")
- Obscure single-track artists.

Return ONLY a JSON array of artists to DELETE:
[
  "Artist Name 1",
  "Artist Name 2"
]
If an artist is genuinely a well-known mainstream artist in Indonesia or globally, DO NOT include them.
Output strictly valid JSON, no markdown."""

    try:
        req = urllib.request.Request(
            "http://127.0.0.1:20128/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            data=json.dumps({
                "model": "cf/@cf/meta/llama-3.3-70b-instruct-fp8-fast",
                "stream": False,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
            }).encode("utf-8")
        )

        with urllib.request.urlopen(req, timeout=25) as resp:
            raw = resp.read().decode("utf-8")
            data = json.loads(raw)
            reply = data["choices"][0]["message"]["content"].strip()
            if "```" in reply:
                reply = re.sub(r"```(?:json)?\s*([\s\S]*?)\s*```", r"\1", reply).strip()
            arr_match = re.search(r"\[\s*\"[\s\S]*\"\s*\]|\[\s*\]", reply)
            if arr_match:
                flagged = json.loads(arr_match.group(0))
                print(f"[{idx+1}/{len(batches)}] Flagged {len(flagged)} obscure artists")
                to_delete_artists.extend(flagged)
            else:
                print(f"[{idx+1}/{len(batches)}] Batch parsed empty")
    except Exception as e:
        print(f"[{idx+1}/{len(batches)}] Error: {e}")

print(f"\nTotal obscure artists flagged for deletion: {len(to_delete_artists)}")

# Delete songs by flagged artists
deleted_song_count = 0
for a in set(to_delete_artists):
    cur.execute("DELETE FROM songs WHERE artist = ? OR artist LIKE ?;", (a, f"{a} %"))
    deleted_song_count += cur.rowcount
    cur.execute("DELETE FROM song_artists WHERE artist_name = ?;", (a,))

cur.execute("DELETE FROM song_artists WHERE song_id NOT IN (SELECT id FROM songs);")
con.commit()

print(f"Successfully purged {deleted_song_count} obscure songs!")

# Recount remaining songs
cur.execute("SELECT COUNT(*) FROM songs;")
print(f"Total clean mainstream songs remaining: {cur.fetchone()[0]}")
con.close()
