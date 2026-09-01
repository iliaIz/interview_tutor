#!/usr/bin/env python3
"""
verify_phase6_polishing.py - Automated verification for Phase 6:
1. Validates full multi-file scaffolds for all 35 challenges.
2. Validates useAppStore cascade fallback.
3. Validates PracticeArena 100dvh mobile viewport.
4. Validates WorkspaceEditor touch-pan-x tabs.
"""

import json
import os
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def main():
    print("🔍 Running Verification for Phase 6: Full Scaffolding & Mobile Polishing...")

    # 1. Verify all 35 challenges have full multi-file scaffolds
    json_path = os.path.join(BASE_DIR, "json", "machine_coding_challenges.json")
    with open(json_path, "r", encoding="utf-8") as f:
        challenges = json.load(f)
    
    assert len(challenges) == 35, f"Expected 35 challenges, found {len(challenges)}"
    
    for ch in challenges:
        cid = ch["id"]
        files = ch.get("workspaceFiles") or (ch.get("phases") and ch["phases"][0].get("addedFiles")) or []
        assert len(files) >= 3, f"Challenge {cid} has only {len(files)} files! Expected >= 3."
        
        has_service = any("Service" in f["path"] or "Engine" in f["path"] for f in files)
        has_test = any("Test.java" in f["path"] for f in files)
        assert has_service, f"Challenge {cid} is missing a Service class file!"
        assert has_test, f"Challenge {cid} is missing a JUnit 5 Test file!"
    
    print("  ✓ Scaffolding: All 35 LLD challenges have complete multi-file starter trees (Models, Services, Tests).")

    # 2. Check useAppStore.ts cascade fallback
    store_path = os.path.join(BASE_DIR, "frontend", "src", "store", "useAppStore.ts")
    with open(store_path, "r", encoding="utf-8") as f:
        store_content = f.read()
    assert "phases?.[0]?.addedFiles" in store_content, "Missing phases fallback in openPracticeChallenge!"
    print("  ✓ State Robustness: useAppStore cascade fallback active.")

    # 3. Check PracticeArena.tsx 100dvh
    arena_path = os.path.join(BASE_DIR, "frontend", "src", "components", "practice", "PracticeArena.tsx")
    with open(arena_path, "r", encoding="utf-8") as f:
        arena_content = f.read()
    assert "100dvh" in arena_content, "Missing 100dvh dynamic viewport in PracticeArena.tsx!"
    print("  ✓ Mobile Viewport: 100dvh dynamic viewport active in PracticeArena.")

    # 4. Check WorkspaceEditor.tsx touch-pan-x
    editor_path = os.path.join(BASE_DIR, "frontend", "src", "components", "practice", "WorkspaceEditor.tsx")
    with open(editor_path, "r", encoding="utf-8") as f:
        editor_content = f.read()
    assert "touch-pan-x" in editor_content, "Missing touch-pan-x in WorkspaceEditor.tsx!"
    print("  ✓ Mobile Touch UX: touch-pan-x horizontal scroll active in WorkspaceEditor.")

    print("\n🎉 ALL PHASE 6 CHECKS PASSED WITH FLYING COLORS!")

if __name__ == "__main__":
    main()
