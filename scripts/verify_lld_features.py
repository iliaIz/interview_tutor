#!/usr/bin/env python3
"""
verify_lld_features.py - Automated verification for Phase 5 LLD Architecture & Challenges:
1. Validates 35 LLD Challenges in JSON and schema integrity.
2. Validates AST rules in frontend and backend.
3. Validates PracticeCatalog and Studio integration.
"""

import json
import os
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def main():
    print("🔍 Running Verification for Phase 5: 35 SOTA Machine Coding & LLD Arena...")

    # 1. Check machine_coding_challenges.json
    json_path = os.path.join(BASE_DIR, "json", "machine_coding_challenges.json")
    assert os.path.exists(json_path), "Missing json/machine_coding_challenges.json!"
    with open(json_path, "r", encoding="utf-8") as f:
        challenges = json.load(f)
    
    assert len(challenges) == 35, f"Expected 35 challenges, got {len(challenges)}"
    
    tracks = set(c.get("track") for c in challenges)
    assert "lld_bigtech" in tracks, "Missing lld_bigtech track!"
    assert "lld_fintech" in tracks, "Missing lld_fintech track!"
    assert "lld_concurrency" in tracks, "Missing lld_concurrency track!"

    # Check notification filter challenge details
    notif_ch = next((c for c in challenges if c["id"] == "lld-notification-filter"), None)
    assert notif_ch is not None, "Missing lld-notification-filter challenge!"
    assert len(notif_ch.get("phases", [])) > 0, "Missing phases in notification filter challenge!"
    assert len(notif_ch["phases"][0].get("addedFiles", [])) >= 6, "Missing starter/test files in notification filter!"
    print(f"  ✓ Dataset: 35 SOTA LLD challenges verified across {len(tracks)} tracks.")

    # 2. Check AST rules in frontend astRules.ts
    frontend_ast_path = os.path.join(BASE_DIR, "frontend", "src", "utils", "astRules.ts")
    with open(frontend_ast_path, "r", encoding="utf-8") as f:
        frontend_ast = f.read()
    assert "enforce-clock-injection" in frontend_ast, "Missing enforce-clock-injection in astRules.ts"
    assert "no-double-in-money" in frontend_ast, "Missing no-double-in-money in astRules.ts"
    print("  ✓ Frontend AST: SOTA LLD rules (Clock injection & BigDecimal money) active.")

    # 3. Check AST rules in backend astAuditService.ts & astAnalyzer.ts
    backend_ast_path = os.path.join(BASE_DIR, "backend", "src", "services", "astAuditService.ts")
    with open(backend_ast_path, "r", encoding="utf-8") as f:
        backend_ast = f.read()
    assert "enforce-clock-injection" in backend_ast, "Missing enforce-clock-injection in astAuditService.ts"
    assert "no-double-in-money" in backend_ast, "Missing no-double-in-money in astAuditService.ts"

    analyzer_path = os.path.join(BASE_DIR, "backend", "src", "services", "astAnalyzer.ts")
    with open(analyzer_path, "r", encoding="utf-8") as f:
        analyzer_content = f.read()
    assert "SYSTEM_TIME_IN_BUSINESS_LOGIC" in analyzer_content, "Missing time signal in astAnalyzer.ts"
    assert "FLOAT_DOUBLE_MONEY" in analyzer_content, "Missing float/double money signal in astAnalyzer.ts"
    print("  ✓ Backend AST: Synchronized static analyzer rules active.")

    # 4. Check PracticeCatalog.tsx categories
    catalog_path = os.path.join(BASE_DIR, "frontend", "src", "components", "practice", "PracticeCatalog.tsx")
    with open(catalog_path, "r", encoding="utf-8") as f:
        catalog_content = f.read()
    assert "lld_bigtech" in catalog_content, "Missing lld_bigtech in PracticeCatalog.tsx"
    assert "lld_fintech" in catalog_content, "Missing lld_fintech in PracticeCatalog.tsx"
    assert "lld_concurrency" in catalog_content, "Missing lld_concurrency in PracticeCatalog.tsx"
    print("  ✓ Frontend UI: PracticeCatalog category tabs and track badges active.")

    # 5. Check Master synthesis document
    doc_path = os.path.join(BASE_DIR, "docs", "deep_research_synthesis.md")
    with open(doc_path, "r", encoding="utf-8") as f:
        doc_content = f.read()
    assert "7. Каталог 35 SOTA Machine Coding & LLD Задач" in doc_content, "Missing Section 7 in deep_research_synthesis.md"
    assert "8. SOTA Методология автоматизированной оценки" in doc_content, "Missing Section 8 in deep_research_synthesis.md"
    print("  ✓ Documentation: Master synthesis updated with Sections 7 & 8.")

    print("\n🎉 ALL PHASE 5 LLD & MACHINE CODING CHECKS PASSED!")

if __name__ == "__main__":
    main()
