#!/usr/bin/env python3
"""
Checkpointed AI-Powered Catalogue Auditor for Tebak Lagu
Audits all songs using 9Router AI models in parallel with auto-checkpointing.
"""

import sqlite3
import urllib.request
import json
import re
import os
import time
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/tebak_lagu.db"))
OUTPUT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/ai_audit_results.json"))
CHECKPOINT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/ai_audit_checkpoint.json"))

def get_api_key():
    with open("/home/schomeserver/.hermes/config.yaml") as f:
        text = f.read()
    m = re.search(r"api_key:\s*([^\s\n]+)", text)
    if not m:
        raise ValueError("Could not find api_key in config.yaml")
    return m.group(1).strip("\"'")

def ask_ai_batch(b_idx, total_batches, songs_batch, api_key):
    prompt = f"""You are a music trivia archivist for an Indonesian music quiz game.
Audit these {len(songs_batch)} songs for data hygiene.
Categories are: "Nostalgia 2000s", "Galau Hits", "Anthem Tongkrongan", "Pop Jawa & Koplo", "Western Hits".

Input list:
{json.dumps(songs_batch, ensure_ascii=False)}

Identify ONLY problematic songs:
- FOREIGN_SCRAPER_ARTIFACT: Foreign/old song that falsely matched an Indonesian band search (e.g. Disney Peter Pan 1953, Broadway Gigi 1942, French Caffeine, Attack on Titan lofi, Tamil soundtracks, Turkish Dere, American Boomerang, etc). Action: "DELETE".
- FAKE_OR_MEME: Fake artist, meme/slowed/sped up low-effort upload, joke track, sound effect. Action: "DELETE".
- WRONG_CATEGORY: Valid song but placed in completely the wrong category (e.g. Western pop songs in "Nostalgia 2000s" or "Pop Jawa"). Action: "MOVE_CATEGORY", suggest correct category.
- INSTRUMENTAL_OR_KARAOKE: Track with no vocals. Action: "DELETE".

Return a JSON array of anomalies. If all songs in this batch are legitimate and in the correct category, return [].
Schema:
[
  {{
    "id": "...",
    "title": "...",
    "artist": "...",
    "category": "...",
    "issue": "FOREIGN_SCRAPER_ARTIFACT" | "FAKE_OR_MEME" | "WRONG_CATEGORY" | "INSTRUMENTAL_OR_KARAOKE",
    "action": "DELETE" | "MOVE_CATEGORY",
    "suggested_category": "Western Hits" | null,
    "reason": "short explanation"
  }}
]
Output strictly valid JSON, no markdown prose."""

    models = ["smart-fast", "cf/@cf/meta/llama-3.3-70b-instruct-fp8-fast", "cf/@cf/zai-org/glm-4.7-flash"]
    for model in models:
        try:
            req = urllib.request.Request(
                "http://127.0.0.1:20128/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                data=json.dumps({
                    "model": model,
                    "stream": False,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1,
                    "max_tokens": 4096,
                }).encode("utf-8")
            )

            with urllib.request.urlopen(req, timeout=18) as resp:
                raw = resp.read().decode("utf-8")
                data = json.loads(raw)
                reply = data["choices"][0]["message"]["content"].strip()
                
                if "```" in reply:
                    code_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", reply)
                    if code_match:
                        reply = code_match.group(1).strip()

                try:
                    anomalies = json.loads(reply.strip())
                except Exception:
                    arr_match = re.search(r"\[\s*\{[\s\S]*\}\s*\]", reply)
                    if arr_match:
                        anomalies = json.loads(arr_match.group(0))
                    else:
                        anomalies = []

                print(f"[{b_idx+1}/{total_batches}] Batch {b_idx+1} OK ({model}): {len(anomalies)} anomalies", flush=True)
                return anomalies
        except Exception as e:
            time.sleep(0.3)

    print(f"[{b_idx+1}/{total_batches}] Batch {b_idx+1} skipped after fallback.", flush=True)
    return []

def main():
    print("==========================================================", flush=True)
    print("    🤖 CHECKPOINTED AI CATALOGUE AUDITOR                 ", flush=True)
    print("==========================================================", flush=True)
    api_key = get_api_key()
    
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    
    # Audit songs in Indonesian categories (where scraper collisions occurred)
    cur.execute("""
        SELECT id, title, artist, year, category 
        FROM songs 
        WHERE category != 'Western Hits'
        ORDER BY category, artist, title;
    """)
    rows = cur.fetchall()
    total_songs = len(rows)
    print(f"Total Indonesian category songs to audit: {total_songs}\n", flush=True)

    BATCH_SIZE = 45
    batches = [rows[i:i + BATCH_SIZE] for i in range(0, total_songs, BATCH_SIZE)]
    total_batches = len(batches)
    print(f"Divided into {total_batches} batches of up to {BATCH_SIZE} songs.", flush=True)

    # Load existing checkpoint if any
    completed_batches = set()
    anomalies_map = {}
    if os.path.exists(CHECKPOINT_PATH):
        try:
            with open(CHECKPOINT_PATH) as f:
                chk = json.load(f)
                completed_batches = set(chk.get("completed_batches", []))
        except Exception:
            pass

    if os.path.exists(OUTPUT_PATH):
        try:
            with open(OUTPUT_PATH) as f:
                existing_list = json.load(f)
                for a in existing_list:
                    if isinstance(a, dict) and a.get("id"):
                        anomalies_map[a["id"]] = a
        except Exception:
            pass

    print(f"Resuming: {len(completed_batches)}/{total_batches} batches already completed in checkpoint.\n", flush=True)

    # Filter batches to run
    batches_to_run = []
    for b_idx, batch in enumerate(batches):
        if b_idx not in completed_batches:
            formatted = [
                {"id": r[0], "title": r[1], "artist": r[2], "year": r[3], "category": r[4]}
                for r in batch
            ]
            batches_to_run.append((b_idx, formatted))

    print(f"Executing {len(batches_to_run)} remaining batches with 3 workers...\n", flush=True)

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            executor.submit(ask_ai_batch, b_idx, total_batches, batch, api_key): b_idx
            for b_idx, batch in batches_to_run
        }

        for future in as_completed(futures):
            b_idx = futures[future]
            try:
                res = future.result()
                if isinstance(res, list):
                    for a in res:
                        if isinstance(a, dict) and a.get("id"):
                            anomalies_map[a["id"]] = a
                
                completed_batches.add(b_idx)
                
                # Save checkpoint and results incrementally
                with open(CHECKPOINT_PATH, "w") as f:
                    json.dump({"completed_batches": list(completed_batches)}, f)

                with open(OUTPUT_PATH, "w") as f:
                    json.dump(list(anomalies_map.values()), f, indent=2)

            except Exception as e:
                print(f"Batch {b_idx+1} error: {e}", flush=True)

    print("\n==========================================================", flush=True)
    print("                   AI AUDIT COMPLETED                     ", flush=True)
    print("==========================================================", flush=True)
    print(f"Total anomalous songs detected by AI: {len(anomalies_map)}", flush=True)
    print(f"Saved to: {OUTPUT_PATH}", flush=True)

if __name__ == "__main__":
    main()
