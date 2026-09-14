"""
Utility: reconcile_report.py
Purpose: Reconciles Gemini Deep Research reports exported via Google Docs (which turns math into base64 images)
with raw text / clipboard (which contains native LaTeX formulas $...$ and $$...$$).

Usage:
  python scripts/reconcile_report.py --md "docs/roadmap/reports/Report.md" --txt "docs/roadmap/reports/Report.txt"
  or if txt is omitted, reads from Windows clipboard:
  python scripts/reconcile_report.py --md "docs/roadmap/reports/Report.md"
"""

import argparse
import os
import re
import subprocess
import sys

def get_clipboard_text():
    try:
        res = subprocess.run(["powershell", "-command", "Get-Clipboard"], capture_output=True, text=True, check=True)
        return res.stdout
    except Exception as e:
        print(f"[WARN] Failed to read clipboard: {e}", file=sys.stderr)
        return ""

def reconcile(md_path: str, txt_path: str = None, out_path: str = None):
    if not os.path.exists(md_path):
        print(f"[ERROR] Markdown file not found: {md_path}", file=sys.stderr)
        return False

    with open(md_path, 'r', encoding='utf-8') as f:
        md_content = f.read()

    if txt_path and os.path.exists(txt_path):
        with open(txt_path, 'r', encoding='utf-8') as f:
            raw_text = f.read()
    else:
        print("[INFO] No txt file provided or found. Reading from system clipboard...")
        raw_text = get_clipboard_text()

    if not raw_text:
        print("[ERROR] No raw text or clipboard content available to extract formulas.", file=sys.stderr)
        return False

    # Extract all LaTeX formulas from raw text
    formulas = re.findall(r'(\${1,2}[^$]+\${1,2})', raw_text)
    print(f"[INFO] Extracted {len(formulas)} LaTeX formulas from reference text.")

    # Count image tags
    img_matches = re.findall(r'!\[\]\[image\d+\]', md_content)
    print(f"[INFO] Found {len(img_matches)} image placeholders in Markdown document.")

    counter = 0
    def replace_img(match):
        nonlocal counter
        if counter < len(formulas):
            formula = formulas[counter]
            counter += 1
            return formula
        return match.group(0)

    reconciled = re.sub(r'!\[\]\[image\d+\]', replace_img, md_content)

    # Strip base64 image definitions at the bottom
    reconciled = re.sub(r'\n+\[image\d+\]:\s*<data:image/[^>]+>', '', reconciled)

    target_out = out_path if out_path else md_path
    with open(target_out, 'w', encoding='utf-8') as f:
        f.write(reconciled.strip() + '\n')

    print(f"[SUCCESS] Reconciled {counter} formulas. Clean document written to: {target_out}")
    return True

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Reconcile Gemini Deep Research MD reports with KaTeX formulas.")
    parser.add_argument("--md", required=True, help="Path to markdown report file")
    parser.add_argument("--txt", default=None, help="Path to raw text file (optional, defaults to clipboard)")
    parser.add_argument("--out", default=None, help="Output markdown path (optional, overwrites --md by default)")
    args = parser.parse_args()

    reconcile(args.md, args.txt, args.out)
