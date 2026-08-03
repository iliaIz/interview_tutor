import fitz
import sys
import re
import json
import os

sys.stdout.reconfigure(encoding='utf-8')

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)
PDF_DIR = os.path.join(BASE_DIR, "pdf_sources")
MD_DIR = os.path.join(BASE_DIR, "markdown")
JSON_DIR = os.path.join(BASE_DIR, "json")

QUESTION_FONTS = {"NotoSans-Regular", "RasputinLight", "OpenSans-Regular"}

def clean_text_quotes(text):
    return text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")

def is_code_line(line, topic="Java Core"):
    l = line.strip()
    if not l:
        return False
    code_keywords = [
        "public class ", "public static void", "System.out.print", "private int ", "private String ",
        "import ", "package ", "@Entity", "@Table", "@Id", "@Autowired", "@Component", "@Service", "@Repository",
        "@Controller", "@RestController", "@Bean", "@Configuration", "docker run ", "docker build ",
        "docker exec ", "docker ps", "docker rm ", "docker rmi ", "docker-compose ", "docker container ",
        "docker image ", "docker volume ", "docker network ", "docker rmi"
    ]
    if any(kw in l for kw in code_keywords):
        return True
    if l in ["{", "}", "};", "})", "];"]:
        return True
    if (l.startswith("public ") or l.startswith("private ") or l.startswith("protected ")) and ("(" in l or "{" in l):
        return True
    if l.startswith("docker ") or l.startswith("docker-compose "):
        return True
    return False

def format_answer_professionally(raw_lines, topic="Java Core"):
    lines = [l.strip() for l in raw_lines if l.strip() and l.strip() != "Read & Write Code"]
    if not lines:
        return ""

    if len(lines) > 4 and ("OVERLOADING" in lines[0] or "OVERRIDING" in lines[0] or "COMPARATOR" in lines[0] or "COMPARABLE" in lines[0]):
        col1_title = lines[0]
        col2_title = lines[1] if len(lines) > 1 else ""
        table_rows = []
        i = 2
        while i < len(lines):
            line1 = lines[i]
            m1 = re.match(r'^(\d+)[\.\)]\s*(.*)', line1)
            if m1 and i + 1 < len(lines):
                num1 = m1.group(1)
                text1 = m1.group(2)
                line2 = lines[i+1]
                m2 = re.match(r'^(\d+)[\.\)]\s*(.*)', line2)
                if m2 and m2.group(1) == num1:
                    text2 = m2.group(2)
                    table_rows.append((num1, text1, text2))
                    i += 2
                    continue
            i += 1
            
        if table_rows:
            md_table = [
                f"| {col1_title} | {col2_title} |",
                "| :--- | :--- |"
            ]
            for num, t1, t2 in table_rows:
                md_table.append(f"| **{num}.** {t1} | **{num}.** {t2} |")
            return "\n".join(md_table)

    blocks = []
    current_text = []
    in_code = False
    code_lines = []

    for line in lines:
        if is_code_line(line, topic):
            if current_text:
                blocks.append(" ".join(current_text))
                current_text = []
            if not in_code:
                in_code = True
                lang = "bash" if ("docker" in line or topic == "Docker") else "java"
                code_lines = [f"```{lang}"]
            code_lines.append(line)
        else:
            if in_code:
                code_lines.append("```")
                blocks.append("\n".join(code_lines))
                in_code = False
                code_lines = []

            m_num = re.match(r'^(\d+)[\.\)]\s*(.*)', line)
            if m_num:
                if current_text:
                    blocks.append(" ".join(current_text))
                    current_text = []
                num = m_num.group(1)
                item_t = m_num.group(2).strip()
                if item_t:
                    current_text.append(f"**{num}.** {item_t}")
                else:
                    current_text.append(f"**{num}.**")
            elif line.startswith("•") or line.startswith("-"):
                if current_text:
                    blocks.append(" ".join(current_text))
                    current_text = []
                blocks.append(f"* {line.lstrip('•- ').strip()}")
            else:
                current_text.append(line)

    if current_text:
        blocks.append(" ".join(current_text))
    if in_code:
        code_lines.append("```")
        formatted = "\n".join(code_lines)
        blocks.append(formatted)

    result_md = "\n\n".join(blocks)
    result_md = clean_text_quotes(result_md)
    return result_md

def parse_pdf_perfect_formatting(cfg):
    pdf_path = os.path.join(PDF_DIR, cfg["pdf_filename"])
    if not os.path.exists(pdf_path):
        return []
    doc = fitz.open(pdf_path)
    cards = []
    
    for page_idx in range(1, len(doc)):
        page = doc[page_idx]
        text_dict = page.get_text("dict")
        
        q_lines = []
        ans_raw_lines = []
        
        for b in text_dict["blocks"]:
            if "lines" not in b:
                continue
            for line in b["lines"]:
                line_text = "".join(span["text"] for span in line["spans"]).strip()
                if not line_text or line_text == "Read & Write Code":
                    continue
                
                fonts_in_line = {span["font"] for span in line["spans"]}
                max_size = max(span["size"] for span in line["spans"])
                is_q = bool(fonts_in_line & QUESTION_FONTS) or (max_size >= 34.0 and bool(re.match(r'^\d+[\.\)]', line_text)))
                
                if is_q:
                    q_lines.append(line_text)
                else:
                    ans_raw_lines.append(line_text)
        
        q_text = " ".join(q_lines).strip()
        q_clean = re.sub(r'^\d+[\.\)]\s*', '', q_text).strip()
        q_clean = re.sub(r'^\.\s*', '', q_clean).strip()
        q_clean = clean_text_quotes(q_clean)
        
        m_num = re.search(r'^(\d+)[\.\)]?', q_text)
        q_num = int(m_num.group(1)) if m_num else None
        
        is_continuation = ("продолжение" in q_clean.lower()) or (not q_text and len(cards) > 0)
        
        if is_continuation and cards:
            cards[-1]["ans_lines"].extend(ans_raw_lines)
            cards[-1]["pages"].append(page_idx + 1)
        elif q_text:
            cards.append({
                "num": q_num if q_num is not None else len(cards) + 1,
                "topic": cfg["topic"],
                "question": q_clean,
                "ans_lines": ans_raw_lines,
                "pages": [page_idx + 1]
            })
        elif cards and ans_raw_lines:
            cards[-1]["ans_lines"].extend(ans_raw_lines)
            cards[-1]["pages"].append(page_idx + 1)

    for c in cards:
        c["answer"] = format_answer_professionally(c["ans_lines"], topic=c["topic"])
        del c["ans_lines"]

    return cards

def main():
    PDF_CONFIG = [
        {"topic": "Java Core", "pdf_filename": "240-core-java-interview-questions-and-answers-all-parts.pdf", "prefix": "JAVA", "md": "java_core_interview_questions.md", "json": "java_core_questions.json"},
        {"topic": "Hibernate ORM", "pdf_filename": "60-hibernate-interview-questions-and-answers-all-parts.pdf", "prefix": "HIBERNATE", "md": "hibernate_interview_questions.md", "json": "hibernate_questions.json"},
        {"topic": "Spring Framework", "pdf_filename": "75-spring-interview-questions-and-answers-all-parts.pdf", "prefix": "SPRING", "md": "spring_interview_questions.md", "json": "spring_questions.json"},
        {"topic": "Docker", "pdf_filename": "docker-interview-questions-and-answers-first-part.pdf", "prefix": "DOCKER1", "md": None, "json": None},
        {"topic": "Docker", "pdf_filename": "docker-interview-questions-and-answers-second-part.pdf", "prefix": "DOCKER2", "prefix": "DOCKER2", "md": None, "json": None}
    ]

    all_topic_cards = {}
    for cfg in PDF_CONFIG:
        cards = parse_pdf_perfect_formatting(cfg)
        topic = cfg["topic"]
        if topic not in all_topic_cards:
            all_topic_cards[topic] = []
        all_topic_cards[topic].extend(cards)

    master_cards = []
    topic_map = [
        {"topic": "Java Core", "md": "java_core_interview_questions.md", "json": "java_core_questions.json", "prefix": "JAVA"},
        {"topic": "Hibernate ORM", "md": "hibernate_interview_questions.md", "json": "hibernate_questions.json", "prefix": "HIBERNATE"},
        {"topic": "Spring Framework", "md": "spring_interview_questions.md", "json": "spring_questions.json", "prefix": "SPRING"},
        {"topic": "Docker", "md": "docker_interview_questions.md", "json": "docker_questions.json", "prefix": "DOCKER"},
    ]

    global_id = 1
    for item in topic_map:
        topic_name = item["topic"]
        cards = all_topic_cards.get(topic_name, [])
        json_data = []
        md_lines = [
            f"# {topic_name} — Вопросы и Ответы для Собеседования",
            f"\n> **Всего вопросов:** {len(cards)} | **Профессионально форматировано для ИИ и разработчиков**\n",
            "---",
            "## Содержание / Быстрый переход\n"
        ]
        for c in cards:
            md_lines.append(f"- [{c['num']}. {c['question']}](#q-{c['num']})")
        md_lines.append("\n---\n")

        for c in cards:
            q_id = f"{item['prefix']}-{c['num']:03d}"
            c_json = {
                "id": q_id,
                "global_id": global_id,
                "num": c["num"],
                "topic": topic_name,
                "question": c["question"],
                "answer": c["answer"],
                "source_pages": c["pages"]
            }
            json_data.append(c_json)
            master_cards.append(c_json)
            global_id += 1

            md_lines.append(f"### <a id=\"q-{c['num']}\"></a>{c['num']}. {c['question']}\n")
            md_lines.append(c["answer"])
            md_lines.append("\n---\n")

        with open(os.path.join(MD_DIR, item["md"]), "w", encoding="utf-8") as f:
            f.write("\n".join(md_lines))
        with open(os.path.join(JSON_DIR, item["json"]), "w", encoding="utf-8") as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)

    master_md_lines = [
        "# Полная База Вопросов и Ответов для Собеседований (Java Core, Spring, Hibernate, Docker)",
        f"\n> **Общее количество вопросов:** {len(master_cards)} | **Профессионально форматировано**\n",
        "## Содержание раздела\n",
        "- [Java Core (240 вопросов)](#java-core)",
        "- [Hibernate ORM (60 вопросов)](#hibernate-orm)",
        "- [Spring Framework (75 вопросов)](#spring-framework)",
        "- [Docker (30 вопросов)](#docker)",
        "\n---\n"
    ]
    current_topic = None
    for item in master_cards:
        if item["topic"] != current_topic:
            current_topic = item["topic"]
            topic_anchor = current_topic.lower().replace(" ", "-")
            master_md_lines.append(f"\n# <a id=\"{topic_anchor}\"></a>{current_topic}\n")
        master_md_lines.append(f"### {item['num']}. {item['question']} `[{item['id']}]`\n")
        master_md_lines.append(item["answer"])
        master_md_lines.append("\n---\n")

    with open(os.path.join(MD_DIR, "all_interview_questions.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(master_md_lines))
    with open(os.path.join(JSON_DIR, "all_interview_questions.json"), "w", encoding="utf-8") as f:
        json.dump(master_cards, f, ensure_ascii=False, indent=2)

    print(f"\n✨ Successfully updated scripts/generate_all_exports.py and exported {len(master_cards)} questions.")

if __name__ == "__main__":
    main()
