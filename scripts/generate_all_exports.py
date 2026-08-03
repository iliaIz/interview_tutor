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

os.makedirs(MD_DIR, exist_ok=True)
os.makedirs(JSON_DIR, exist_ok=True)

PDF_CONFIG = [
    {
        "id_prefix": "JAVA",
        "topic": "Java Core",
        "pdf_filename": "240-core-java-interview-questions-and-answers-all-parts.pdf",
        "expected_count": 240,
        "md_filename": "java_core_interview_questions.md",
        "json_filename": "java_core_questions.json",
        "code_lang": "java"
    },
    {
        "id_prefix": "HIBERNATE",
        "topic": "Hibernate ORM",
        "pdf_filename": "60-hibernate-interview-questions-and-answers-all-parts.pdf",
        "expected_count": 60,
        "md_filename": "hibernate_interview_questions.md",
        "json_filename": "hibernate_questions.json",
        "code_lang": "java"
    },
    {
        "id_prefix": "SPRING",
        "topic": "Spring Framework",
        "pdf_filename": "75-spring-interview-questions-and-answers-all-parts.pdf",
        "expected_count": 75,
        "md_filename": "spring_interview_questions.md",
        "json_filename": "spring_questions.json",
        "code_lang": "java"
    },
    {
        "id_prefix": "DOCKER1",
        "topic": "Docker",
        "pdf_filename": "docker-interview-questions-and-answers-first-part.pdf",
        "expected_count": 15,
        "md_filename": None,
        "json_filename": None,
        "code_lang": "bash"
    },
    {
        "id_prefix": "DOCKER2",
        "topic": "Docker",
        "pdf_filename": "docker-interview-questions-and-answers-second-part.pdf",
        "expected_count": 15,
        "md_filename": None,
        "json_filename": None,
        "code_lang": "bash"
    }
]

QUESTION_FONTS = {"NotoSans-Regular", "RasputinLight", "OpenSans-Regular"}

def clean_text_quotes(text):
    return text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")

def detect_and_format_code(text, default_lang="java"):
    lines = text.split("\n")
    formatted_lines = []
    in_code_block = False
    code_block = []
    
    code_keywords = [
        "public class ", "public static void main", "System.out.print", "private int ", "private String ",
        "import ", "package ", "@Entity", "@Table", "@Id", "@Autowired", "@Component", "@Service", "@Repository",
        "@Controller", "@RestController", "@Bean", "@Configuration", "docker run ", "docker build ",
        "docker exec ", "docker ps", "docker rm ", "docker rmi ", "docker-compose ", "docker container ",
        "docker image ", "docker volume ", "docker network "
    ]
    
    for i, line in enumerate(lines):
        l_strip = line.strip()
        is_code = False
        
        if any(kw in l_strip for kw in code_keywords):
            is_code = True
        elif l_strip in ["{", "}", "};", "}", "})", "];"]:
            is_code = True
        elif (l_strip.startswith("public ") or l_strip.startswith("private ") or l_strip.startswith("protected ")) and ("(" in l_strip or "{" in l_strip):
            is_code = True
        elif l_strip.startswith("docker ") or l_strip.startswith("docker-compose"):
            is_code = True
        elif in_code_block and (l_strip.startswith("//") or l_strip.startswith("/*") or l_strip.startswith("*") or l_strip.endswith(";") or l_strip.endswith("{") or l_strip.endswith("}")):
            is_code = True
            
        if is_code:
            if not in_code_block:
                in_code_block = True
                lang = "bash" if ("docker" in l_strip or default_lang == "bash") else "java"
                code_block = [f"```{lang}"]
            code_block.append(line)
        else:
            if in_code_block:
                if not l_strip and i + 1 < len(lines) and any(kw in lines[i+1].strip() for kw in code_keywords):
                    code_block.append(line)
                else:
                    code_block.append("```")
                    formatted_lines.extend(code_block)
                    in_code_block = False
                    code_block = []
                    formatted_lines.append(line)
            else:
                formatted_lines.append(line)
                
    if in_code_block:
        code_block.append("```")
        formatted_lines.extend(code_block)
        
    return "\n".join(formatted_lines)

def parse_pdf_to_cards(cfg):
    pdf_path = os.path.join(PDF_DIR, cfg["pdf_filename"])
    if not os.path.exists(pdf_path):
        print(f"Warning: PDF file not found at {pdf_path}")
        return []
        
    doc = fitz.open(pdf_path)
    cards = []
    
    for page_idx in range(1, len(doc)):
        page = doc[page_idx]
        text_dict = page.get_text("dict")
        
        q_lines = []
        ans_lines = []
        
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
                    ans_lines.append(line_text)
        
        q_text = " ".join(q_lines).strip()
        ans_text = "\n".join(ans_lines).strip()
        
        q_clean = re.sub(r'^\d+[\.\)]\s*', '', q_text).strip()
        q_clean = re.sub(r'^\.\s*', '', q_clean).strip()
        q_clean = clean_text_quotes(q_clean)
        
        m_num = re.search(r'^(\d+)[\.\)]?', q_text)
        q_num = int(m_num.group(1)) if m_num else None
        
        is_continuation = ("продолжение" in q_clean.lower()) or (not q_text and len(cards) > 0)
        ans_clean = clean_text_quotes(ans_text)
        
        if is_continuation and cards:
            cards[-1]["answer_parts"].append(ans_clean)
            cards[-1]["pages"].append(page_idx + 1)
        elif q_text:
            cards.append({
                "num": q_num if q_num is not None else len(cards) + 1,
                "topic": cfg["topic"],
                "question": q_clean,
                "answer_parts": [ans_clean] if ans_clean else [],
                "pages": [page_idx + 1],
                "code_lang": cfg["code_lang"]
            })
        elif cards and ans_clean:
            cards[-1]["answer_parts"].append(ans_clean)
            cards[-1]["pages"].append(page_idx + 1)
            
    for c in cards:
        raw_ans = "\n\n".join(c["answer_parts"])
        c["answer_raw"] = raw_ans
        c["answer_md"] = detect_and_format_code(raw_ans, default_lang=c["code_lang"])
        del c["answer_parts"]
        del c["code_lang"]
        
    return cards

def main():
    all_topic_cards = {}
    
    for cfg in PDF_CONFIG:
        cards = parse_pdf_to_cards(cfg)
        print(f"Parsed {cfg['topic']} ({cfg['pdf_filename']}): {len(cards)} questions")
        topic = cfg["topic"]
        if topic not in all_topic_cards:
            all_topic_cards[topic] = []
        all_topic_cards[topic].extend(cards)

    master_cards = []
    topic_file_map = [
        {"topic": "Java Core", "md": "java_core_interview_questions.md", "json": "java_core_questions.json", "prefix": "JAVA"},
        {"topic": "Hibernate ORM", "md": "hibernate_interview_questions.md", "json": "hibernate_questions.json", "prefix": "HIBERNATE"},
        {"topic": "Spring Framework", "md": "spring_interview_questions.md", "json": "spring_questions.json", "prefix": "SPRING"},
        {"topic": "Docker", "md": "docker_interview_questions.md", "json": "docker_questions.json", "prefix": "DOCKER"},
    ]
    
    global_id = 1
    
    for item in topic_file_map:
        topic_name = item["topic"]
        cards = all_topic_cards.get(topic_name, [])
        
        json_data = []
        md_lines = [
            f"# {topic_name} — Вопросы и Ответы для Собеседования",
            f"\n> **Всего вопросов:** {len(cards)} | **Формат:** Оптимизировано для ИИ и самостоятельного изучения\n",
            "---",
            "## Содержание / Быстрый переход\n"
        ]
        
        for c in cards:
            anchor = f"q-{c['num']}"
            md_lines.append(f"- [{c['num']}. {c['question']}](#{anchor})")
            
        md_lines.append("\n---\n")
        
        for c in cards:
            q_id = f"{item['prefix']}-{c['num']:03d}"
            c_json = {
                "id": q_id,
                "global_id": global_id,
                "num": c["num"],
                "topic": topic_name,
                "question": c["question"],
                "answer": c["answer_md"],
                "source_pages": c["pages"]
            }
            json_data.append(c_json)
            master_cards.append(c_json)
            global_id += 1
            
            md_lines.append(f"### <a id=\"q-{c['num']}\"></a>{c['num']}. {c['question']}\n")
            md_lines.append(c["answer_md"])
            md_lines.append("\n---\n")

        with open(os.path.join(MD_DIR, item["md"]), "w", encoding="utf-8") as f:
            f.write("\n".join(md_lines))
            
        with open(os.path.join(JSON_DIR, item["json"]), "w", encoding="utf-8") as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)

    # Master Markdown
    master_md_lines = [
        "# Полная База Вопросов и Ответов для Собеседований (Java Core, Spring, Hibernate, Docker)",
        f"\n> **Общее количество вопросов:** {len(master_cards)} | **Оптимизировано для ИИ и разработчиков**\n",
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

    # Master JSON
    with open(os.path.join(JSON_DIR, "all_interview_questions.json"), "w", encoding="utf-8") as f:
        json.dump(master_cards, f, ensure_ascii=False, indent=2)

    print("\n✅ Successfully regenerated all Markdown and JSON exports!")

if __name__ == "__main__":
    main()
