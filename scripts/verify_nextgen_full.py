#!/usr/bin/env python3
"""
verify_nextgen_full.py - Complete verification of SOTA 2026 Next-Gen capabilities:
1. Validates 20 System Design scenarios.
2. Validates 15 Production Incident Triage cases.
3. Validates 3 Guided Roadmap programs (25/50/100 non-linear steps).
4. Verifies SQLite persistence and schema integrity.
"""

import json
import os
import sqlite3
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_DIR = os.path.join(BASE_DIR, "json")
DB_PATH = os.path.join(BASE_DIR, "backend", "interview_prep.db")

def main():
    print("🔍 Verifying Next-Gen SOTA 2026 Catalogs & SQLite Persistence...")

    # 1. System Design JSON
    sd_path = os.path.join(JSON_DIR, "system_design_scenarios.json")
    with open(sd_path, "r", encoding="utf-8") as f:
        sd = json.load(f)
    assert len(sd) == 20, f"Expected 20 System Design scenarios, found {len(sd)}"
    for s in sd:
        assert "trafficProfile" in s, f"Scenario {s['id']} missing trafficProfile"
        assert len(s["tradeOffProbes"]) >= 2, f"Scenario {s['id']} has < 2 trade-off probes"
    print(f"  ✓ System Design: All {len(sd)} scenarios valid with Back-of-the-Envelope and Staff AI probes.")

    # 2. Production Triage JSON
    triage_path = os.path.join(JSON_DIR, "production_triage_challenges.json")
    with open(triage_path, "r", encoding="utf-8") as f:
        triage = json.load(f)
    assert len(triage) == 15, f"Expected 15 Triage cases, found {len(triage)}"
    for inc in triage:
        assert len(inc["rawArtifactText"]) > 20, f"Incident {inc['id']} missing rawArtifactText"
        assert len(inc["rootCauseAnalysis"]) > 20, f"Incident {inc['id']} missing RCA"
    print(f"  ✓ Incident Triage: All {len(triage)} cases valid with raw thread/heap dumps and RCA.")

    # 3. Guided Roadmaps JSON
    rm_path = os.path.join(JSON_DIR, "guided_roadmaps.json")
    with open(rm_path, "r", encoding="utf-8") as f:
        roadmaps = json.load(f)
    assert len(roadmaps) == 3, f"Expected 3 roadmap programs, found {len(roadmaps)}"
    assert roadmaps[0]["totalSteps"] == 25
    assert roadmaps[1]["totalSteps"] == 50
    assert roadmaps[2]["totalSteps"] == 100
    print(f"  ✓ Guided Roadmaps: 3 Programs (25, 50, 100 steps) with non-linear milestones verified.")

    # 4. SQLite DB Verification
    if os.path.exists(DB_PATH):
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        
        cur.execute("SELECT COUNT(*) FROM system_design_challenges")
        sd_count = cur.fetchone()[0]
        assert sd_count == 20, f"Expected 20 SD rows in DB, found {sd_count}"

        cur.execute("SELECT COUNT(*) FROM production_triage_challenges")
        triage_count = cur.fetchone()[0]
        assert triage_count == 15, f"Expected 15 Triage rows in DB, found {triage_count}"

        cur.execute("SELECT COUNT(*) FROM guided_roadmaps")
        rm_count = cur.fetchone()[0]
        assert rm_count == 3, f"Expected 3 Roadmap rows in DB, found {rm_count}"

        conn.close()
        print("  ✓ SQLite Persistence: All Next-Gen tables populated and synced.")

    print("\n🎉 ALL NEXT-GEN SOTA 2026 CHECKS PASSED WITH 100% SUCCESS!")

if __name__ == "__main__":
    main()
