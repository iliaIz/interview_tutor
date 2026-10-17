#!/usr/bin/env python3
"""
build_refactoring_bank.py
Parses SOTA Deep Research reports in docs/research/refactoring_interview_katas/reports/
and synthesizes 24 canonical Refactoring Challenges into:
1. json/refactoring_challenges.json
2. SQLite table coding_challenges in data/interview.db

Target Standard: SOTA Late 2026 Refactoring & Code Review Bank
Cognitive Bounding Limit: <= 350 lines (Rule 8).
"""

import os
import re
import json
import sqlite3

REPORTS_DIR = 'docs/research/refactoring_interview_katas/reports'
JSON_OUT = 'json/refactoring_challenges.json'
DB_PATH = 'data/interview.db'

def extract_code_block(text):
    """Extracts first ```java ... ``` code block from text."""
    m = re.search(r'```(?:java)?\s*\n(.*?)```', text, re.DOTALL)
    if m:
        return m.group(1).strip()
    return ""

def determine_file_path(java_code, is_test=False, default_name="Solution"):
    """Derives maven-standard src/main/java or src/test/java path from Java code."""
    pkg_match = re.search(r'package\s+([\w\.]+);', java_code)
    pkg = pkg_match.group(1) if pkg_match else "com.interview.refactoring"
    cls_match = re.search(r'public\s+(?:final\s+|sealed\s+|abstract\s+)?(?:class|interface|record|enum)\s+(\w+)', java_code)
    cls_name = cls_match.group(1) if cls_match else default_name
    
    pkg_path = pkg.replace('.', '/')
    base_folder = "src/test/java" if is_test else "src/main/java"
    return f"{base_folder}/{pkg_path}/{cls_name}.java"

def parse_report_katas(filepath, kata_split_regex):
    """Splits a report into discrete kata dictionaries."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    splits = re.split(kata_split_regex, content)
    katas = []
    # splits format: [preamble, id1, title1, body1, id2, title2, body2, ...]
    for i in range(1, len(splits), 3):
        k_id = splits[i].strip()
        k_title = splits[i+1].strip()
        k_body = splits[i+2]
        katas.append((k_id, k_title, k_body))
    return katas

def parse_kata_details(k_id, k_title, k_body):
    """Extracts sub-sections, code blocks, smells, and questions from a single kata body."""
    # 1. Grade & Difficulty mapping
    if k_id.startswith('L0-'):
        grade = 'L0_JUNIOR'
        difficulty = 'Junior'
    elif k_id.startswith('L1-'):
        grade = 'L1_MIDDLE'
        difficulty = 'Middle'
    elif k_id.startswith('L2-'):
        grade = 'L2_SENIOR'
        difficulty = 'Senior'
    else:
        grade = 'L3_STAFF'
        difficulty = 'Lead'

    slug = f"{k_id.lower()}-{re.sub(r'[^a-z0-9]+', '-', k_title.lower()).strip('-')[:50]}"

    # 2. Company context
    company_context = "BigTech / FinTech Tier-1 Screening"
    m_company = re.search(r'#### (?:2\.\s*)?Company Context\s*\n+(.*?)(?=####|\Z)', k_body, re.DOTALL)
    if m_company:
        company_context = m_company.group(1).strip()

    # 3. Dirty Code
    dirty_code = ""
    m_dirty = re.search(r'#### (?:3\.\s*)?The (?:\"Dirty\"|Legacy) Code[^\n]*\n+(.*?)(?=####|\Z)', k_body, re.DOTALL)
    if m_dirty:
        dirty_code = extract_code_block(m_dirty.group(1))

    # 4. Pin-Down Tests
    test_code = ""
    m_test = re.search(r'#### (?:5\.\s*)?(?:Pin-Down Test Suite|Stress Test[^\n]*|Characterization Harness)[^\n]*\n+(.*?)(?=####|\Z)', k_body, re.DOTALL)
    if m_test:
        test_code = extract_code_block(m_test.group(1))

    # 5. Clean Solution
    clean_code = ""
    m_clean = re.search(r'#### (?:6\.\s*)?Refactored Clean (?:Code|Solution|Architecture)[^\n]*\n+(.*?)(?=####|\Z)', k_body, re.DOTALL)
    if m_clean:
        clean_code = extract_code_block(m_clean.group(1))

    # 6. Smells & Findings
    smells = []
    m_smells = re.search(r'#### (?:4\.\s*)?(?:Code Smells Checklist|Concurrency Audit Findings|Architectural Smells[^\n]*)\s*\n+(.*?)(?=####|\Z)', k_body, re.DOTALL)
    if m_smells:
        raw_smells_text = m_smells.group(1).strip()
        # Strategy A: Check for bullet items
        smell_lines = [line.strip() for line in raw_smells_text.splitlines() if line.strip().startswith(('-', '*', '|'))]
        if smell_lines:
            for idx, s_line in enumerate(smell_lines[:5]):
                cleaned_name = re.sub(r'^[-*|\s]+', '', s_line).split(':')[0].strip(' *|`')
                if cleaned_name and not cleaned_name.startswith('Smell'):
                    smells.append({
                        "id": f"{k_id.lower()}-smell-{idx+1}",
                        "name": cleaned_name[:80],
                        "category": "CONCURRENCY_JMM" if "L2" in k_id else ("ARCHITECTURAL_COUPLING" if "L3" in k_id else "CLEAN_CODE"),
                        "description": s_line[:200],
                        "voiceKeywords": [w.lower() for w in re.findall(r'[A-Za-zА-Яа-я0-9_-]{4,}', cleaned_name)[:4]],
                        "severity": "CRITICAL" if idx == 0 else "MAJOR"
                    })
        # Strategy B: If no bullets, parse paragraphs (Report 1/2 style with English names in parentheses or sentences)
        if not smells:
            # Look for English terms in parentheses e.g. (Arrow Anti-Pattern & High Cyclomatic Complexity)
            terms = re.findall(r'\(([A-Z][A-Za-z0-9\s,&/-]{5,70})\)', raw_smells_text)
            paras = [p.strip() for p in raw_smells_text.split('\n') if len(p.strip()) > 50 and not p.strip().startswith('####')]
            if terms and len(terms) >= 2:
                for idx, t in enumerate(terms[:5]):
                    desc = paras[idx] if idx < len(paras) else t
                    smells.append({
                        "id": f"{k_id.lower()}-smell-{idx+1}",
                        "name": t[:80],
                        "category": "CONCURRENCY_JMM" if "L2" in k_id else ("ARCHITECTURAL_COUPLING" if "L3" in k_id else "CLEAN_CODE"),
                        "description": desc[:200],
                        "voiceKeywords": [w.lower() for w in re.findall(r'[A-Za-zА-Яа-я0-9_-]{4,}', t)[:4]],
                        "severity": "CRITICAL" if idx == 0 else "MAJOR"
                    })
            elif paras:
                for idx, p in enumerate(paras[:4]):
                    lead = p.split('.')[0]
                    smells.append({
                        "id": f"{k_id.lower()}-smell-{idx+1}",
                        "name": lead[:80].strip(' *#`'),
                        "category": "CONCURRENCY_JMM" if "L2" in k_id else ("ARCHITECTURAL_COUPLING" if "L3" in k_id else "CLEAN_CODE"),
                        "description": p[:200],
                        "voiceKeywords": [w.lower() for w in re.findall(r'[A-Za-zА-Яа-я0-9_-]{4,}', lead)[:4]],
                        "severity": "CRITICAL" if idx == 0 else "MAJOR"
                    })

        # Strategy C: If fewer than 2 smells, check for ordinal indicators
        if len(smells) < 2:
            parts = [p.strip() for p in re.split(r'(?=(?:Первая|Вторая|Третья|Четвертая|Пятая|Первый|Второй|Третий|Четвертый)\s+(?:проблема|дефект|запах))', raw_smells_text) if len(p.strip()) > 20 and not p.strip().startswith('На этапе')]
            if len(parts) >= 2:
                smells = []
                for idx, p in enumerate(parts[:5]):
                    lead = p.split('.')[0]
                    smells.append({
                        "id": f"{k_id.lower()}-smell-{idx+1}",
                        "name": lead[:80].strip(' *#`'),
                        "category": "CONCURRENCY_JMM" if "L2" in k_id else ("ARCHITECTURAL_COUPLING" if "L3" in k_id else "CLEAN_CODE"),
                        "description": p[:200],
                        "voiceKeywords": [w.lower() for w in re.findall(r'[A-Za-zА-Яа-я0-9_-]{4,}', lead)[:4]],
                        "severity": "CRITICAL" if idx == 0 else "MAJOR"
                    })


    if not smells:
        smells.append({
            "id": f"{k_id.lower()}-smell-primary",
            "name": f"Architectural Smell in {k_id}",
            "category": "CLEAN_CODE",
            "description": "Primary architectural defect identified in legacy service",
            "voiceKeywords": ["refactoring", "smell", "architecture"],
            "severity": "CRITICAL"
        })


    # 7. Follow-up / Bar-Raiser questions
    questions = []
    m_q = re.search(r'#### (?:7\.\s*)?(?:Interview Follow-Up Questions|Bar-Raiser Follow-Up Questions|Staff Bar-Raiser Trade-Off Defense)\s*\n+(.*?)(?=###|\Z)', k_body, re.DOTALL)
    if m_q:
        q_text = m_q.group(1).strip()
        raw_chunks = [s.strip() for s in q_text.split('\n') if len(s.strip()) > 20]
        sentences = []
        for chunk in raw_chunks:
            split_sentences = [s.strip() for s in re.split(r'\.\s+', chunk) if len(s.strip()) > 30]
            if len(split_sentences) > 1:
                sentences.extend(split_sentences)
            else:
                sentences.append(chunk)

        for idx, sentence in enumerate(sentences[:4]):
            clean_sentence = sentence.strip(' *#-`')
            if clean_sentence and not clean_sentence.endswith('.'):
                clean_sentence += '.'
            questions.append({
                "id": f"{k_id.lower()}-bar-raiser-{idx+1}",
                "questionText": clean_sentence[:300],
                "voicePrompt": clean_sentence[:150],
                "idealResponseSummary": "Detailed defense demonstrating JVM 21 LTS mechanics, JMM invariants, or architectural trade-offs.",
                "followUpDeepDives": ["Edge case handling under high concurrency", "Rollback and failure recovery"]
            })

    # 8. Workspace file packaging
    dirty_path = determine_file_path(dirty_code, is_test=False, default_name=f"{k_id.replace('-', '')}Service")
    test_path = determine_file_path(test_code, is_test=True, default_name=f"{k_id.replace('-', '')}Test")
    clean_path = determine_file_path(clean_code, is_test=False, default_name=f"{k_id.replace('-', '')}Service")

    workspace_files = [
        {
            "path": dirty_path,
            "content": dirty_code,
            "readOnly": False,
            "hidden": False,
            "isMainEntryPoint": True
        },
        {
            "path": test_path,
            "content": test_code,
            "readOnly": False,
            "hidden": False
        }
    ]

    reference_files = [
        {
            "path": clean_path,
            "content": clean_code,
            "readOnly": True,
            "hidden": False
        }
    ]

    # 9. AST constraints
    disallowed_ast = []
    disallowed_fields = []
    if "L2-REF-01" in k_id:
        disallowed_ast.append("SynchronizedTree")
    if "L0-REF-01" in k_id or "L1-REF-04" in k_id or "L1-REF-02" in k_id:
        disallowed_fields.extend(["double", "float"])

    return {
        "id": k_id,
        "slug": slug,
        "title": k_title.split('—')[0].split('(')[0].strip(),
        "grade": grade,
        "archetype": k_title.split(':')[-1].strip(),
        "category": "refactoring_kata",
        "track": "refactoring",
        "badge": "🛡️ Refactoring Kata",
        "difficulty": difficulty,
        "targetStack": "Java 21 LTS",
        "estimatedMinutes": 45,
        "companyContext": company_context,
        "shortDescription": f"Каноническая задача на рефакторинг ({difficulty} {grade}): {k_title[:120]}.",
        "instructionsMarkdown": f"### Задание\nПроведите аудит и безопасный рефакторинг сервиса `{k_id}` под защитой характеризационных тестов.\n\n#### Контекст компании\n{company_context}",
        "workspaceFiles": workspace_files,
        "referenceSolutionFiles": reference_files,
        "smellsChecklist": smells,
        "socraticProbes": [
            {
                "triggerCondition": "candidate_silent_5s",
                "spokenGuidance": f"Обрати внимание на контрактные обязательства и запахи кода в файле {os.path.basename(dirty_path)}."
            }
        ],
        "barRaiserQuestions": questions,
        "structuralConstraints": {
            "disallowedAstNodes": disallowed_ast,
            "disallowedClassImports": ["java.lang.ThreadLocal"] if "REF-06" in k_id and "L2" in k_id else [],
            "disallowedFieldTypes": disallowed_fields,
            "requiredInjections": ["java.time.Clock"] if "L1-REF-08" in k_id or "L1-REF-04" in k_id else []
        },
        "scoringWeights": {
            "functionalCorrectness": 0.4,
            "concurrencySafety": 0.2,
            "architectureAndCleanCode": 0.2,
            "modernIdioms": 0.1,
            "oralDefense": 0.1
        }
    }

def main():
    print("🚀 [Wave 16] Building Canonical Refactoring Kata Bank...")
    
    # 1. Parse Report 1 (L0 & L1)
    rep1_path = os.path.join(REPORTS_DIR, "Архитектурный-рефакторинг,-запахи-кода-и-паттерны-проектирования-в-Java-21-LTS-К.md")
    katas_rep1 = parse_report_katas(rep1_path, r'### \[(L[01]-REF-\d+)\]\s+([^\n]+)')
    print(f"  Extracted {len(katas_rep1)} katas from Report 1 (L0 & L1)")

    # 2. Parse Report 2 (L2)
    rep2_path = os.path.join(REPORTS_DIR, "Архитектурный-аудит-и-рефакторинг-высоконагруженных-систем-на-Java-21-LTS-Конкур.md")
    katas_rep2 = parse_report_katas(rep2_path, r'### \[(L2-REF-\d+)\]\s+([^\n]+)')
    print(f"  Extracted {len(katas_rep2)} katas from Report 2 (L2)")

    # 3. Parse Report 3 (L3)
    rep3_path = os.path.join(REPORTS_DIR, "Архитектурный-рефакторинг-уровня-Staff-и-Principal-(L3)-декомпозиция-монолитов,-.md")
    katas_rep3 = parse_report_katas(rep3_path, r'### Kata \d+:\s+\[(L3-REF-\d+)\]\s+([^\n]+)')
    print(f"  Extracted {len(katas_rep3)} katas from Report 3 (L3)")

    all_raw = katas_rep1 + katas_rep2 + katas_rep3
    print(f"  Total raw katas parsed: {len(all_raw)}")

    manifests = []
    for k_id, k_title, k_body in all_raw:
        item = parse_kata_details(k_id, k_title, k_body)
        manifests.append(item)

    # Write json/refactoring_challenges.json
    os.makedirs('json', exist_ok=True)
    with open(JSON_OUT, 'w', encoding='utf-8') as f:
        json.dump(manifests, f, ensure_ascii=False, indent=2)
    print(f"✅ Saved {len(manifests)} manifests to {JSON_OUT}")

    # Inject into SQLite
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    injected_count = 0
    for m in manifests:
        manifest_str = json.dumps(m, ensure_ascii=False)
        cur.execute("""
            INSERT OR REPLACE INTO coding_challenges (
                id, slug, title, category, track, badge, difficulty,
                target_stack, time_limit_minutes, short_description,
                instructions_markdown, manifest_json, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (
            m['id'],
            m['slug'],
            m['title'],
            m['category'],
            m['track'],
            m['badge'],
            m['difficulty'],
            m['targetStack'],
            m['estimatedMinutes'],
            m['shortDescription'],
            m['instructionsMarkdown'],
            manifest_str
        ))
        injected_count += 1

    conn.commit()
    conn.close()
    print(f"✅ Injected {injected_count} Refactoring Challenges into SQLite ({DB_PATH})")

if __name__ == '__main__':
    main()