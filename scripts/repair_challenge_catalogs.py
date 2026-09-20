#!/usr/bin/env python3
"""
repair_challenge_catalogs.py
Cleans up broken UTF-8 encoding in challenge titles and normalizes difficulty casing in SQLite DB and JSON.
"""

import json
import os
import sqlite3
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "backend", "data", "interview.db")
JSON_PATH = os.path.join(BASE_DIR, "json", "machine_coding_challenges.json")

TITLE_FIXES = {
    "lld-key-value-cache-ttl": "In-Memory Key-Value Cache с TTL и LRU/LFU",
    "lld-task-scheduler-cron": "Task Scheduler с Cron и Приоритетами",
    "lld-url-shortener": "URL Shortener с Base62 и TTL",
    "lld-rate-limiting-gateway-priority": "Rate Limiting Gateway с VIP-приоритетами",
}

def repair_db():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # 1. Fix broken titles
    for cid, fixed_title in TITLE_FIXES.items():
        c.execute("UPDATE coding_challenges SET title = ? WHERE id = ?", (fixed_title, cid))
        print(f"Updated title for {cid} -> {fixed_title}")

    # 2. Normalize difficulty casing to Title Case: Junior, Middle, Senior, Lead
    diff_map = {
        "junior": "Junior",
        "middle": "Middle",
        "senior": "Senior",
        "lead": "Lead",
    }
    for old_d, new_d in diff_map.items():
        res = c.execute("UPDATE coding_challenges SET difficulty = ? WHERE difficulty = ?", (new_d, old_d))
        if res.rowcount > 0:
            print(f"Normalized difficulty '{old_d}' -> '{new_d}': {res.rowcount} rows updated")

    # 3. Add and populate task_code column
    cols = [cinfo[1] for cinfo in c.execute("PRAGMA table_info(coding_challenges)").fetchall()]
    if "task_code" not in cols:
        c.execute("ALTER TABLE coding_challenges ADD COLUMN task_code TEXT")
        print("Added task_code column to coding_challenges table")

    diff_order = {"Junior": 0, "Middle": 1, "Senior": 2, "Lead": 3}

    # Testing katas: TST-01 .. TST-42
    testing_rows = c.execute("SELECT id, difficulty FROM coding_challenges WHERE track = 'testing_mutation'").fetchall()
    sorted_testing = sorted(testing_rows, key=lambda r: (diff_order.get(r[1], 99), r[0]))
    for idx, (cid, _) in enumerate(sorted_testing, 1):
        code = f"TST-{idx:02d}"
        c.execute("UPDATE coding_challenges SET task_code = ? WHERE id = ?", (code, cid))

    print(f"Assigned task_code TST-01..TST-{len(sorted_testing):02d} to testing katas")

    # LLD challenges: LLD-01 .. LLD-55
    lld_rows = c.execute("SELECT id, difficulty FROM coding_challenges WHERE track != 'testing_mutation'").fetchall()
    sorted_lld = sorted(lld_rows, key=lambda r: (diff_order.get(r[1], 99), r[0]))
    for idx, (cid, _) in enumerate(sorted_lld, 1):
        code = f"LLD-{idx:02d}"
        c.execute("UPDATE coding_challenges SET task_code = ? WHERE id = ?", (code, cid))

    print(f"Assigned task_code LLD-01..LLD-{len(sorted_lld):02d} to LLD challenges")

    conn.commit()
    conn.close()
    print("Database repair complete.")

def repair_json():
    if not os.path.exists(JSON_PATH):
        print(f"JSON not found at {JSON_PATH}")
        return

    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    updated_count = 0
    for item in data:
        cid = item.get("id")
        if cid in TITLE_FIXES:
            item["title"] = TITLE_FIXES[cid]
            updated_count += 1
        if "difficulty" in item:
            item["difficulty"] = item["difficulty"].capitalize()

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"JSON repair complete: {updated_count} titles fixed.")

if __name__ == "__main__":
    print(f"Starting catalog repair in {BASE_DIR}...")
    repair_db()
    repair_json()
    print("Done!")
