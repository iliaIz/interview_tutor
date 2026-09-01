import glob
import os
import re
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

reports = [
    "d:/projects/interview_projects/spring/ds_reports/Исследование LLD Собеседований Java.md",
    "d:/projects/interview_projects/spring/ds_reports/FinTech Machine Coding Java 21.md",
    "d:/projects/interview_projects/spring/ds_reports/Concurrent LLD на Java 21.md",
    "d:/projects/interview_projects/spring/ds_reports/Автоматизированная оценка Machine Coding.md"
]

for r in reports:
    print("\n" + "="*70)
    print(f"📄 REPORT: {os.path.basename(r)}")
    print("="*70)
    if not os.path.exists(r):
        print("  File not found!")
        continue
    with open(r, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    print(f"  Total lines: {len(lines)}, Total size: {os.path.getsize(r)/1024:.1f} KB")
    print("  Sections & Tasks:")
    for line in lines:
        line_clean = line.strip()
        if re.match(r"^#{1,4}\s+", line_clean):
            if any(term in line_clean.lower() for term in ["задач", "engine", "limiter", "cache", "ledger", "outbox", "pool", "disp", "harness", "оценк", "рубрик", "критер"]):
                print(f"    {line_clean}")
            elif re.match(r"^#{2,3}\s+\d+", line_clean) or re.match(r"^#{2,3}\s+\*\*\d+", line_clean):
                print(f"    {line_clean}")
