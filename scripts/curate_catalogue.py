#!/usr/bin/env python3
"""
Elite Catalogue Curator for Tebak Lagu
1. Purges all songs without guaranteed 4-stanza lyrics (eliminates dead/unplayable/obscure tracks).
2. Curates Indonesian categories:
   - Relocates famous Western hits (e.g. Alanis Morissette, Alessia Cara, etc.) to 'Western Hits'.
   - Purges obscure foreign scraper noise (e.g. 2 Minutos, 616 undone, ASTN, @onefive, Annuals, etc.).
3. Cleans orphaned artists and recalculates counts.
4. Optimizes SQLite database with VACUUM.
"""

import sqlite3
import json
import re

DB_PATH = "data/tebak_lagu.db"

def main():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    cur.execute("SELECT COUNT(*) FROM songs;")
    initial_count = cur.fetchone()[0]
    print(f"Initial songs in database: {initial_count}")

    # STEP 1: Purge all songs without 4 stanzas of lyrics
    print("\n--- STEP 1: PURGING SONGS WITHOUT 4-STANZA LYRICS ---")
    cur.execute("""
        DELETE FROM songs 
        WHERE lyrics_clues IS NULL OR json_array_length(lyrics_clues) < 4;
    """)
    purged_no_lyrics = cur.rowcount
    print(f"Purged {purged_no_lyrics} songs without valid 4-stanza lyrics.")

    # STEP 2: Curate foreign artifacts in Indonesian categories
    print("\n--- STEP 2: CURATING INDONESIAN CATEGORIES ---")
    # Artists that are Western stars accidentally in Indo categories -> Move to Western Hits
    famous_western_to_move = [
        "alanis morissette", "alessia cara", "amber run", "3 doors down", "ace hood",
        "angel du$t", "arcade fire", "arctic monkeys", "avril lavigne", "backstreet boys",
        "bon jovi", "britney spears", "bruno mars", "calvin harris", "charlie puth",
        "coldplay", "ed sheeran", "elton john", "dua lipa", "harry styles", "imagine dragons",
        "john mayer", "katy perry", "lady gaga", "maroon 5", "michael jackson", "oasis",
        "paramore", "queen", "radiohead", "rihanna", "taylor swift", "the beatles",
        "the killers", "the script", "westlife", "david guetta", "pat travers"
    ]

    # Obscure scraper noise in Indonesian categories -> DELETE
    obscure_noise_to_purge = [
        "2 minutos", "616 undone.", "@onefive", "alicia dc", "astn", "allison's invention",
        "andrew rannells", "annuals", "anurag kulkarni", "aqyila", "bcalm & banks",
        "becoming sons", "binaural beats", "black tiger sex machine", "blvckid",
        "brass band", "florida all-state", "charles e. kauffman", "compas nationaliste",
        "courtni & j.l.l.", "da mizzy", "dani male", "darkid", "derek amato", "dezine",
        "dimension 32", "dirty south", "dj abram", "dj unpier", "dogjaw", "doriann",
        "dslnsag", "east coast wind ensemble", "egyptian blue", "elsa", "eluvium",
        "eminence africa", "escapism refuge", "eskay toda", "fairies", "fairy dreams",
        "fone-bsb", "forest halo", "franco divine", "grogg", "healing potpourri",
        "henrisoul", "howard shore", "ian wong", "interia!", "jazz paladin", "j.l.l.",
        "john rose", "kracktwist", "kristina", "krystal roxx", "kvbvlv", "landen king",
        "lee soo young", "les kitschenette's", "light star", "lisa gerrard", "lny tnz",
        "lullaby legends", "lyla in the loop", "malte marten", "mapumba", "marietto",
        "mark mancina", "mega collins", "mitch wong", "mofo rising", "nabowa", "new pallapa",
        "nick colionne", "nina agustin", "nopain", "novcerelia", "nstens1117", "ohs consultant",
        "ok chamomile", "oliver wallace", "omar faruk tekbilek", "orchestra", "otr & panama",
        "peter f. gontha", "peter pan", "quince", "random", "ratakiri", "red hot chili peppers - antonovvi",
        "roger gray", "roger williams", "sachiko miyashita", "sadworldbeats", "sergio mendes",
        "shadow dancer", "slamm", "sons of the east", "sonson", "soothe my soul", "start aliens",
        "strawbs", "stríð & friður", "tawnbei", "tayeh", "ten athlone", "the encounter",
        "the hutchfest collective", "the spaceheads", "thirsty eyes", "thrive worship",
        "tussi dematteis", "upon a star", "vic damone", "violet eternal", "weather balloon",
        "worm shepherd", "xdinary heroes", "yasunori nishiki", "yonder mountain", "yutaka yamada",
        "zahid brifkanî", "zombie", "sadness", "heapper & ahh", "9t4", "lyodra mahalini"
    ]

    cur.execute("SELECT id, title, artist, category FROM songs WHERE category != 'Western Hits';")
    indo_songs = cur.fetchall()

    moved_count = 0
    purged_noise_count = 0

    for song in indo_songs:
        sid, title, artist, cat = song
        a_low = artist.lower()
        t_low = title.lower()

        # Check if famous Western star in Indo category -> MOVE
        if any(w in a_low for w in famous_western_to_move):
            cur.execute("UPDATE songs SET category = 'Western Hits' WHERE id = ?;", (sid,))
            moved_count += 1
            continue

        # Check if obscure scraper noise -> DELETE
        if any(n in a_low for n in obscure_noise_to_purge):
            cur.execute("DELETE FROM songs WHERE id = ?;", (sid,))
            cur.execute("DELETE FROM song_artists WHERE song_id = ?;", (sid,))
            purged_noise_count += 1
            continue

        # Check if single foreign words matching exact band name
        if a_low in ["naif", "sore", "armada", "kotak", "geisha", "rossa", "padi", "caffeine", "slank", "noah", "ungu", "dewa", "sheila"]:
            # If the title is in English / Spanish and not by the actual band
            if any(w in t_low for w in ["remix", "super slowed", "slowed", "ambient", "tribute", "karaoke"]):
                cur.execute("DELETE FROM songs WHERE id = ?;", (sid,))
                cur.execute("DELETE FROM song_artists WHERE song_id = ?;", (sid,))
                purged_noise_count += 1

    print(f"Relocated {moved_count} Western songs to 'Western Hits'.")
    print(f"Purged {purged_noise_count} obscure scraper noise tracks.")

    # STEP 3: Clean up artists table
    print("\n--- STEP 3: CLEANING ARTISTS TABLE ---")
    cur.execute("""
        UPDATE artists 
        SET song_count = (
            SELECT COUNT(*) FROM song_artists WHERE song_artists.artist_id = artists.id
        );
    """)
    cur.execute("DELETE FROM artists WHERE song_count = 0;")
    print(f"Cleaned {cur.rowcount} orphaned artists.")

    con.commit()

    # Final stats
    cur.execute("SELECT COUNT(*) FROM songs;")
    final_count = cur.fetchone()[0]
    print(f"\nFinal Curated Song Count: {final_count} songs (Purged {initial_count - final_count} total records)")

    cur.execute("""
        SELECT category, COUNT(*) as cnt, COUNT(DISTINCT artist) as artists
        FROM songs
        GROUP BY category
        ORDER BY cnt DESC;
    """)
    print("\n=== DISTRIBUSI KATALOG TERKURASI (100% INDONESIA & BARAT) ===")
    for r in cur.fetchall():
        print(f"• {r[0]}: {r[1]} lagu ({r[2]} artis terkenal)")

    # STEP 4: VACUUM
    print("\nOptimizing database (VACUUM)...")
    cur.execute("VACUUM;")
    con.close()
    print("Database curated, cleaned, and vacuumed successfully!")

if __name__ == "__main__":
    main()
