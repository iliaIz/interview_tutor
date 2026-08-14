#!/usr/bin/env python3
"""
Скрипт извлечения, форматирования, дедупликации и интеграции вопросов по Spring и Spring Boot
из источников:
- Baeldung Spring (https://www.baeldung.com/spring-interview-questions)
- Baeldung Spring Boot (https://www.baeldung.com/spring-boot-interview-questions)
- InterviewBit Spring (https://www.interviewbit.com/spring-interview-questions)
"""

import os
import sys
import re
import json
from bs4 import BeautifulSoup, NavigableString

sys.stdout.reconfigure(encoding='utf-8')

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)
MD_DIR = os.path.join(BASE_DIR, "markdown")
SOURCES_DIR = os.path.join(MD_DIR, "sources")
JSON_DIR = os.path.join(BASE_DIR, "json")

STEP_DIR = r"C:\Users\Admin\.gemini\antigravity-ide\brain\127d7e6c-cd78-4c21-9673-22c5a7054ffb\.system_generated\steps"
BAELDUNG_SPRING_FILE = os.path.join(STEP_DIR, "170", "content.md")
BAELDUNG_BOOT_FILE = os.path.join(STEP_DIR, "172", "content.md")
INTERVIEWBIT_FILE = os.path.join(STEP_DIR, "174", "content.md")

os.makedirs(SOURCES_DIR, exist_ok=True)
os.makedirs(JSON_DIR, exist_ok=True)
os.makedirs(MD_DIR, exist_ok=True)

def html_node_to_md(node):
    """Convert HTML DOM elements to clean GitHub-flavored Markdown."""
    if isinstance(node, NavigableString):
        return str(node)
    
    tag = node.name
    if not tag:
        return ""

    if tag in ['strong', 'b']:
        inner = "".join(html_node_to_md(c) for c in node.children).strip()
        return f"**{inner}** " if inner else ""
    elif tag in ['em', 'i']:
        inner = "".join(html_node_to_md(c) for c in node.children).strip()
        return f"*{inner}* " if inner else ""
    elif tag == 'code':
        return f"`{node.get_text()}`"
    elif tag == 'pre':
        code = node.get_text()
        lang = "java"
        if "server.port" in code or "spring.datasource" in code:
            lang = "properties"
        elif "dependencies:" in code or "server:\n" in code:
            lang = "yaml"
        elif "<dependency>" in code:
            lang = "xml"
        return f"\n```{lang}\n{code.strip()}\n```\n"
    elif tag == 'ul':
        items = []
        for li in node.find_all('li', recursive=False):
            li_md = "".join(html_node_to_md(c) for c in li.children).strip()
            items.append(f"* {li_md}")
        return "\n" + "\n".join(items) + "\n"
    elif tag == 'ol':
        items = []
        for i, li in enumerate(node.find_all('li', recursive=False), 1):
            li_md = "".join(html_node_to_md(c) for c in li.children).strip()
            items.append(f"{i}. {li_md}")
        return "\n" + "\n".join(items) + "\n"
    elif tag == 'p':
        inner = "".join(html_node_to_md(c) for c in node.children).strip()
        return f"\n{inner}\n"
    elif tag == 'blockquote':
        inner = "".join(html_node_to_md(c) for c in node.children).strip()
        return f"\n> {inner}\n"
    elif tag == 'table':
        rows = []
        for tr in node.find_all('tr'):
            cells = [c.get_text(strip=True) for c in tr.find_all(['th', 'td'])]
            if cells:
                rows.append("| " + " | ".join(cells) + " |")
        if len(rows) > 1:
            header_sep = "| " + " | ".join(["---"] * len(node.find_all('tr')[0].find_all(['th', 'td']))) + " |"
            return "\n" + rows[0] + "\n" + header_sep + "\n" + "\n".join(rows[1:]) + "\n"
        return ""
    else:
        return "".join(html_node_to_md(c) for c in node.children)

def parse_baeldung(filepath, title_prefix="Baeldung"):
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        html = f.read()
    soup = BeautifulSoup(html, "html.parser")
    content = soup.find("div", class_="entry-content") or soup.find("article") or soup
    
    questions = []
    h3_tags = content.find_all("h3")
    for h3 in h3_tags:
        title = h3.get_text(strip=True)
        if not re.match(r'^Q\d+\.', title):
            continue
        
        q_clean = re.sub(r'^Q\d+\.\s*', '', title).strip()
        # Clean formatting
        ans_parts = []
        curr = h3.next_sibling
        while curr:
            if curr.name in ["h2", "h3"]:
                break
            if curr.name in ["p", "ul", "ol", "pre", "blockquote", "table"]:
                ans_parts.append(html_node_to_md(curr))
            curr = curr.next_sibling
            
        ans_md = "\n".join(ans_parts).strip()
        # Clean extra newlines
        ans_md = re.sub(r'\n{3,}', '\n\n', ans_md)
        
        questions.append({
            "title": q_clean,
            "answer": ans_md,
            "source": title_prefix
        })
    return questions

def parse_interviewbit(filepath):
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        text = f.read()
    
    lines = text.split("\n")
    questions = []
    current_q = None
    current_body = []
    
    for line in lines:
        m = re.match(r'^###\s+(\d+\.\s+.*)$', line.strip())
        if m:
            if current_q:
                ans_text = "\n".join(current_body).strip()
                ans_text = re.sub(r'\n{3,}', '\n\n', ans_text)
                questions.append({
                    "title": current_q,
                    "answer": ans_text,
                    "source": "InterviewBit"
                })
                current_body = []
            
            raw_title = m.group(1).strip()
            # Clean number prefix
            current_q = re.sub(r'^\d+\.\s*', '', raw_title).strip()
        elif current_q is not None:
            # Skip advertisement/download lines
            if any(stop in line.lower() for stop in ["download pdf", "scaler", "mock interview", "free mock assessment", "online java compiler"]):
                continue
            current_body.append(line)
            
    if current_q:
        ans_text = "\n".join(current_body).strip()
        ans_text = re.sub(r'\n{3,}', '\n\n', ans_text)
        questions.append({
            "title": current_q,
            "answer": ans_text,
            "source": "InterviewBit"
        })
        
    return questions

def export_source_md(questions, filename, title, url):
    lines = [
        f"# {title}",
        f"\n> **Source URL:** [{url}]({url}) | **Total Questions:** {len(questions)}\n",
        "---",
        "## Table of Contents\n"
    ]
    for idx, q in enumerate(questions, 1):
        lines.append(f"- [{idx}. {q['title']}](#q-{idx})")
    lines.append("\n---\n")
    
    for idx, q in enumerate(questions, 1):
        lines.append(f"### <a id=\"q-{idx}\"></a>{idx}. {q['title']}\n")
        lines.append(q['answer'])
        lines.append("\n---\n")
        
    out_path = os.path.join(SOURCES_DIR, filename)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f" Saved source: {out_path} ({len(questions)} questions)")

def main():
    print("🚀 Extracting and formatting questions from 3 sources...\n")
    
    # 1. Baeldung Spring
    baeldung_spring_qs = parse_baeldung(BAELDUNG_SPRING_FILE, "Baeldung Spring")
    export_source_md(
        baeldung_spring_qs,
        "baeldung_spring_interview_questions.md",
        "Baeldung — Spring Framework Interview Questions",
        "https://www.baeldung.com/spring-interview-questions"
    )
    
    # 2. Baeldung Spring Boot
    baeldung_boot_qs = parse_baeldung(BAELDUNG_BOOT_FILE, "Baeldung Spring Boot")
    export_source_md(
        baeldung_boot_qs,
        "baeldung_spring_boot_interview_questions.md",
        "Baeldung — Spring Boot Interview Questions",
        "https://www.baeldung.com/spring-boot-interview-questions"
    )
    
    # 3. InterviewBit Spring
    ib_qs = parse_interviewbit(INTERVIEWBIT_FILE)
    export_source_md(
        ib_qs,
        "interviewbit_spring_interview_questions.md",
        "InterviewBit — Top 70+ Spring Interview Questions",
        "https://www.interviewbit.com/spring-interview-questions"
    )
    
    # 4. Master merged English source
    all_raw_qs = baeldung_spring_qs + baeldung_boot_qs + ib_qs
    export_source_md(
        all_raw_qs,
        "merged_all_spring_questions.md",
        "Merged Spring & Spring Boot Questions (Baeldung + InterviewBit Raw)",
        "Multiple Sources"
    )
    print(f"\n✨ Extracted total {len(all_raw_qs)} raw questions across all 3 sources.")

if __name__ == "__main__":
    main()
