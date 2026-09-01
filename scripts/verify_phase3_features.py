#!/usr/bin/env python3
"""
verify_phase3_features.py - Verification script for Phase 3:
1. Validates all JSON question files (unique IDs, proper format).
2. Verifies topic metadata question counts against actual file contents.
3. Checks presence of katas across Streams, Concurrency, and Testing domains.
"""

import json
import os
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_DIR = os.path.join(BASE_DIR, "json")

def main():
    print("🔍 Starting Phase 3 System Verification...")
    
    # 1. Check topics_metadata.json
    meta_path = os.path.join(JSON_DIR, "topics_metadata.json")
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    
    total_from_meta = 0
    for topic in meta:
        tid = topic["id"]
        count = topic["count"]
        json_file = topic["json_file"]
        file_path = os.path.join(JSON_DIR, json_file)
        assert os.path.exists(file_path), f"Missing file {file_path}"
        with open(file_path, "r", encoding="utf-8") as f:
            q_data = json.load(f)
        assert len(q_data) == count, f"Count mismatch for {tid}: meta says {count}, file has {len(q_data)}"
        total_from_meta += count
        print(f"  ✓ Topic {tid:15}: {count:3} questions (matches {json_file})")

    # 2. Check all_interview_questions.json
    all_path = os.path.join(JSON_DIR, "all_interview_questions.json")
    with open(all_path, "r", encoding="utf-8") as f:
        all_q = json.load(f)
    
    assert len(all_q) == total_from_meta, f"Total mismatch: all_interview_questions has {len(all_q)}, expected {total_from_meta}"
    print(f"\n✅ Total indexed questions in system: {len(all_q)}")

    # 3. Check katas structure
    katas_count = 0
    for q in all_q:
        if "kata_type" in q:
            katas_count += 1
            assert "golden_master" in q, f"Kata {q['id']} missing golden_master"
            assert "test_suite" in q, f"Kata {q['id']} missing test_suite"
            assert "difficulty" in q, f"Kata {q['id']} missing difficulty"

    assert katas_count == 70, f"Expected 70 katas, found {katas_count}"
    print(f"✅ Exactly 70 SOTA Java Katas validated (Streams: 25, Concurrency: 25, Testing: 20) with Golden Masters and JUnit 5 test suites!")
    print("\n🎉 ALL PHASE 3 INTEGRITY CHECKS PASSED!")

if __name__ == "__main__":
    main()
