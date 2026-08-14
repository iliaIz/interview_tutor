#!/usr/bin/env python3
"""
Скрипт миграции и генерации актуальной базы вопросов и ответов
из репозитория enhorse/java-interview (https://github.com/enhorse/java-interview.git)
и источников по Spring / Spring Boot (Baeldung + InterviewBit).
"""

import os
import sys
import re
import json
import shutil
import subprocess

sys.stdout.reconfigure(encoding='utf-8')

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)
MD_DIR = os.path.join(BASE_DIR, "markdown")
JSON_DIR = os.path.join(BASE_DIR, "json")
FRONTEND_PUBLIC_DIR = os.path.join(BASE_DIR, "frontend", "public")
TEMP_ENHORSE_DIR = os.path.join(BASE_DIR, "_temp_enhorse")

# Import curated Spring & Spring Boot datasets
from build_spring_topics import get_spring_framework_questions, get_spring_boot_questions

# 24 topics specification
TOPIC_CONFIGS = [
    {
        "file": "core.md",
        "slug": "core",
        "name": "Java Core",
        "prefix": "CORE",
        "category": "Core Java & JVM",
        "icon": "coffee",
        "color": "#E08E89",
        "description": "Основы языка, синтаксис, типы данных, память, исключения и классы",
        "is_custom": False
    },
    {
        "file": "oop.md",
        "slug": "oop",
        "name": "ООП (OOP)",
        "prefix": "OOP",
        "category": "Core Java & JVM",
        "icon": "boxes",
        "color": "#6C5CE7",
        "description": "Принципы ООП, абстракция, инкапсуляция, наследование, полиморфизм",
        "is_custom": False
    },
    {
        "file": "jvm.md",
        "slug": "jvm",
        "name": "JVM & Память",
        "prefix": "JVM",
        "category": "Core Java & JVM",
        "icon": "cpu",
        "color": "#A29BFE",
        "description": "Архитектура JVM, загрузчики классов, стек, куча, сборка мусора",
        "is_custom": False
    },
    {
        "file": "jcf.md",
        "slug": "jcf",
        "name": "Java Collections Framework",
        "prefix": "JCF",
        "category": "Core Java & JVM",
        "icon": "layers",
        "color": "#00CEC9",
        "description": "List, Set, Map, Queue, внутреннее устройство HashMap, TreeMap и Concurrent коллекций",
        "is_custom": False
    },
    {
        "file": "java8.md",
        "slug": "java8",
        "name": "Java 8+ Features",
        "prefix": "JAVA8",
        "category": "Core Java & JVM",
        "icon": "sparkles",
        "color": "#FD79A8",
        "description": "Лямбда-выражения, Stream API, Optional, функциональные интерфейсы, default методы",
        "is_custom": False
    },
    {
        "file": "concurrency.md",
        "slug": "concurrency",
        "name": "Многопоточность (Concurrency)",
        "prefix": "CONC",
        "category": "Architecture & Concurrency",
        "icon": "zap",
        "color": "#FF7675",
        "description": "Threads, volatile, synchronized, JMM, java.util.concurrent, блокировки и пулы потоков",
        "is_custom": False
    },
    {
        "file": "io.md",
        "slug": "io",
        "name": "I/O & NIO",
        "prefix": "IO",
        "category": "Architecture & Concurrency",
        "icon": "arrow-left-right",
        "color": "#FDCB6E",
        "description": "Байтовые и символьные потоки, буферизация, неблокирующий ввод/вывод (NIO/NIO2)",
        "is_custom": False
    },
    {
        "file": "serialization.md",
        "slug": "serialization",
        "name": "Сериализация",
        "prefix": "SERIAL",
        "category": "Architecture & Concurrency",
        "icon": "archive",
        "color": "#E17055",
        "description": "Serializable, Externalizable, serialVersionUID, transient поля и безопасность",
        "is_custom": False
    },
    {
        "file": "patterns.md",
        "slug": "patterns",
        "name": "Паттерны проектирования",
        "prefix": "PAT",
        "category": "Architecture & Concurrency",
        "icon": "git-fork",
        "color": "#0984E3",
        "description": "Порождающие, структурные и поведенческие шаблоны проектирования (GoF)",
        "is_custom": False
    },
    {
        "file": "db.md",
        "slug": "db",
        "name": "Базы данных",
        "prefix": "DB",
        "category": "Data & Storage",
        "icon": "database",
        "color": "#00B894",
        "description": "Реляционная модель, транзакции (ACID), уровни изоляции, нормализация и индексы",
        "is_custom": False
    },
    {
        "file": "sql.md",
        "slug": "sql",
        "name": "SQL & Оконные функции",
        "prefix": "SQL",
        "category": "Data & Storage",
        "icon": "table",
        "color": "#55EFC4",
        "description": "SELECT, JOIN, группировки, агрегаты, оконные функции RANK, DENSE_RANK, NTILE",
        "is_custom": False
    },
    {
        "file": "jdbc.md",
        "slug": "jdbc",
        "name": "JDBC",
        "prefix": "JDBC",
        "category": "Data & Storage",
        "icon": "link",
        "color": "#81ECEC",
        "description": "Драйверы, Connection, Statement, PreparedStatement, ResultSet, пулы соединений",
        "is_custom": False
    },
    {
        "file": "spring.md",
        "slug": "spring",
        "name": "Spring Framework",
        "prefix": "SPRING",
        "category": "Web & Enterprise",
        "icon": "leaf",
        "color": "#5A9E96",
        "description": "IoC/DI контейнер, бины, скоупы, AOP, @Transactional, Spring MVC, WebFlux",
        "is_custom": True,
        "loader": get_spring_framework_questions
    },
    {
        "file": "spring_boot.md",
        "slug": "spring-boot",
        "name": "Spring Boot",
        "prefix": "BOOT",
        "category": "Web & Enterprise",
        "icon": "zap",
        "color": "#6DB33F",
        "description": "Автоконфигурация, Starters, Actuator, Profiles, Spring Boot 3, GraalVM AOT",
        "is_custom": True,
        "loader": get_spring_boot_questions
    },
    {
        "file": "reactive.md",
        "slug": "reactive",
        "name": "Реактивное программирование",
        "prefix": "REACT",
        "category": "Web & Enterprise",
        "icon": "activity",
        "color": "#D63031",
        "description": "Reactive Streams, Mono, Flux, Backpressure, Project Reactor и RxJava",
        "is_custom": False
    },
    {
        "file": "servlets.md",
        "slug": "servlets",
        "name": "Servlets & JSP",
        "prefix": "SERV",
        "category": "Web & Enterprise",
        "icon": "server",
        "color": "#74B9FF",
        "description": "Жизненный цикл сервлетов, фильтры, слушатели, HttpSession, JSP и Servlet API",
        "is_custom": False
    },
    {
        "file": "web.md",
        "slug": "web",
        "name": "Основы Web & REST",
        "prefix": "WEB",
        "category": "Web & Enterprise",
        "icon": "globe",
        "color": "#0984E3",
        "description": "Протокол HTTP/HTTPS, методы, коды ответов, REST архитектура, Cookies и Сессии",
        "is_custom": False
    },
    {
        "file": "kafka.md",
        "slug": "kafka",
        "name": "Apache Kafka",
        "prefix": "KAFKA",
        "category": "Web & Enterprise",
        "icon": "radio",
        "color": "#E84393",
        "description": "Брокеры, топики, партиции, Consumer Groups, гарантии доставки (at-least-once, exactly-once)",
        "is_custom": False
    },
    {
        "file": "test.md",
        "slug": "test",
        "name": "Тестирование (JUnit, Mockito)",
        "prefix": "TEST",
        "category": "Engineering & Tools",
        "icon": "check-circle-2",
        "color": "#2ECC71",
        "description": "Модульное тестирование, TDD, аннотации JUnit 5, моки, стабы, Mockito и ассерты",
        "is_custom": False
    },
    {
        "file": "log.md",
        "slug": "log",
        "name": "Журналирование (Logging)",
        "prefix": "LOG",
        "category": "Engineering & Tools",
        "icon": "file-text",
        "color": "#B2BEC3",
        "description": "Уровни логирования (DEBUG, INFO, WARN, ERROR), SLF4J фасад, Logback, Log4j2",
        "is_custom": False
    },
    {
        "file": "xml.md",
        "slug": "xml",
        "name": "XML & JSON Парсеры",
        "prefix": "XML",
        "category": "Engineering & Tools",
        "icon": "code-2",
        "color": "#636E72",
        "description": "DOM, SAX, StAX парсеры, валидация DTD/XSD, маршалинг JAXB и работа с JSON",
        "is_custom": False
    },
    {
        "file": "uml.md",
        "slug": "uml",
        "name": "UML Диаграммы",
        "prefix": "UML",
        "category": "Engineering & Tools",
        "icon": "network",
        "color": "#2D3436",
        "description": "Диаграммы классов, последовательности (Sequence), состояний и отношений в ООП",
        "is_custom": False
    },
    {
        "file": "html.md",
        "slug": "html",
        "name": "Основы HTML",
        "prefix": "HTML",
        "category": "Frontend Basics",
        "icon": "file-code",
        "color": "#E67E22",
        "description": "Структура документа, теги, семантический HTML5, формы, ссылки и таблицы",
        "is_custom": False
    },
    {
        "file": "css.md",
        "slug": "css",
        "name": "Основы CSS",
        "prefix": "CSS",
        "category": "Frontend Basics",
        "icon": "palette",
        "color": "#3498DB",
        "description": "Селекторы, блочная модель (Box Model), Flexbox, Grid, каскадность и специфичность",
        "is_custom": False
    }
]

def ensure_source_repo():
    """Ensure enhorse repository is available locally."""
    if not os.path.exists(TEMP_ENHORSE_DIR) or not os.path.exists(os.path.join(TEMP_ENHORSE_DIR, "core.md")):
        print("Cloning enhorse/java-interview repository...")
        subprocess.run(
            ["git", "clone", "--depth", "1", "https://github.com/enhorse/java-interview.git", TEMP_ENHORSE_DIR],
            check=True
        )

def copy_images():
    """Copy SQL and other diagrams to frontend public folder."""
    src_images = os.path.join(TEMP_ENHORSE_DIR, "images")
    dst_images = os.path.join(FRONTEND_PUBLIC_DIR, "images")
    
    if os.path.exists(src_images):
        os.makedirs(dst_images, exist_ok=True)
        for root, dirs, files in os.walk(src_images):
            rel_path = os.path.relpath(root, src_images)
            target_dir = os.path.join(dst_images, rel_path) if rel_path != "." else dst_images
            os.makedirs(target_dir, exist_ok=True)
            for f in files:
                src_file = os.path.join(root, f)
                dst_file = os.path.join(target_dir, f)
                shutil.copy2(src_file, dst_file)
        print(f"Copied image assets to {dst_images}")

def clean_text_quotes(text):
    return text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")

def clean_answer_content(body, slug):
    body = re.sub(r'\[к оглавлению\]\(.*?\)', '', body, flags=re.IGNORECASE)
    body = re.sub(r'\[к оглавлению\]', '', body, flags=re.IGNORECASE)
    body = re.sub(r'\[Вопросы для собеседования\]\(.*?\)', '', body, flags=re.IGNORECASE)
    body = re.sub(r'!\[(.*?)\]\(images/(.*?)\)', r'![\1](/images/\2)', body)
    body = clean_text_quotes(body)
    return body.strip()

def parse_topic_file(config):
    if config.get("is_custom") and "loader" in config:
        raw_items = config["loader"]()
        questions = []
        for idx, item in enumerate(raw_items, 1):
            q_id = f"{config['prefix']}-{idx:03d}"
            questions.append({
                "id": q_id,
                "num": idx,
                "topic": config["name"],
                "topic_slug": config["slug"],
                "category": config["category"],
                "question": clean_text_quotes(item["question"]),
                "answer": clean_answer_content(item["answer"], config["slug"]),
                "source_pages": ["Baeldung / InterviewBit (Curated)"]
            })
        return questions

    file_path = os.path.join(TEMP_ENHORSE_DIR, config["file"])
    if not os.path.exists(file_path):
        print(f"Warning: {file_path} not found!")
        return []

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    parts = re.split(r'\n##\s+', '\n' + content)
    questions = []
    
    q_num = 1
    for part in parts[1:]:
        lines = part.strip().split('\n')
        if not lines:
            continue
        
        q_title = lines[0].strip()
        ans_body = '\n'.join(lines[1:]).strip()

        if q_title.lower().startswith('полезные ссылки') or q_title.lower().startswith('оглавление'):
            continue

        q_title_clean = clean_text_quotes(q_title)
        q_title_clean = re.sub(r'<a id=.*?></a>', '', q_title_clean).strip()
        
        ans_clean = clean_answer_content(ans_body, config["slug"])
        if not ans_clean:
            ans_clean = "_Ответ в процессе дополнения._"

        q_id = f"{config['prefix']}-{q_num:03d}"
        
        questions.append({
            "id": q_id,
            "num": q_num,
            "topic": config["name"],
            "topic_slug": config["slug"],
            "category": config["category"],
            "question": q_title_clean,
            "answer": ans_clean,
            "source_pages": [f"enhorse/java-interview:{config['file']}"]
        })
        q_num += 1

    return questions

def main():
    print("🚀 Starting unified questions migration (24 topics including Spring & Spring Boot)...\n")
    ensure_source_repo()
    copy_images()

    os.makedirs(MD_DIR, exist_ok=True)
    os.makedirs(JSON_DIR, exist_ok=True)

    all_master_questions = []
    topic_summaries = []
    global_id = 1

    for cfg in TOPIC_CONFIGS:
        cards = parse_topic_file(cfg)
        print(f"  • {cfg['name']:32s} [{cfg['slug']:14s}]: {len(cards):3d} вопросов")
        
        topic_json_data = []
        source_label = "Baeldung / InterviewBit" if cfg.get("is_custom") else "[enhorse/java-interview](https://github.com/enhorse/java-interview)"
        topic_md_lines = [
            f"# {cfg['name']} — Вопросы и Ответы для Собеседования",
            f"\n> **Раздел:** {cfg['category']} | **Всего вопросов:** {len(cards)} | **Источник:** {source_label}\n",
            f"*{cfg['description']}*\n",
            "---",
            "## Содержание / Быстрый переход\n"
        ]

        for c in cards:
            anchor = f"q-{c['num']}"
            topic_md_lines.append(f"- [{c['num']}. {c['question']}](#{anchor})")
        
        topic_md_lines.append("\n---\n")

        for c in cards:
            c["global_id"] = global_id
            global_id += 1
            
            c_json = {
                "id": c["id"],
                "global_id": c["global_id"],
                "num": c["num"],
                "topic": c["topic"],
                "question": c["question"],
                "answer": c["answer"],
                "source_pages": c["source_pages"]
            }
            topic_json_data.append(c_json)
            all_master_questions.append(c_json)

            topic_md_lines.append(f"### <a id=\"q-{c['num']}\"></a>{c['num']}. {c['question']} `[{c['id']}]`\n")
            topic_md_lines.append(c["answer"])
            topic_md_lines.append("\n---\n")

        # Save per-topic json
        topic_json_file = f"{cfg['slug']}_questions.json"
        with open(os.path.join(JSON_DIR, topic_json_file), "w", encoding="utf-8") as f:
            json.dump(topic_json_data, f, ensure_ascii=False, indent=2)

        # Save per-topic markdown
        topic_md_file = f"{cfg['slug']}_interview_questions.md"
        with open(os.path.join(MD_DIR, topic_md_file), "w", encoding="utf-8") as f:
            f.write("\n".join(topic_md_lines))

        topic_summaries.append({
            "id": cfg["slug"],
            "name": cfg["name"],
            "prefix": cfg["prefix"],
            "category": cfg["category"],
            "icon": cfg["icon"],
            "color": cfg["color"],
            "description": cfg["description"],
            "count": len(cards),
            "json_file": topic_json_file,
            "md_file": topic_md_file
        })

    # Generate master JSON
    master_json_path = os.path.join(JSON_DIR, "all_interview_questions.json")
    with open(master_json_path, "w", encoding="utf-8") as f:
        json.dump(all_master_questions, f, ensure_ascii=False, indent=2)

    # Generate master Markdown
    master_md_lines = [
        "# Полная База Вопросов и Ответов для Собеседований Java Developer",
        f"\n> **Всего вопросов в базе:** {len(all_master_questions)} | **24 тематических раздела** | **Источники:** enhorse/java-interview, Baeldung, InterviewBit\n",
        "## Категории и разделы базы знаний\n"
    ]

    current_cat = None
    for item in topic_summaries:
        if item["category"] != current_cat:
            current_cat = item["category"]
            master_md_lines.append(f"\n### {current_cat}\n")
        master_md_lines.append(f"- **[{item['name']}](./{item['md_file']})** (`{item['prefix']}`) — {item['count']} вопросов: *{item['description']}*")

    master_md_lines.append("\n---\n")

    current_topic_name = None
    for q in all_master_questions:
        if q["topic"] != current_topic_name:
            current_topic_name = q["topic"]
            anchor = current_topic_name.lower().replace(" ", "-").replace("&", "").replace("/", "")
            master_md_lines.append(f"\n# <a id=\"{anchor}\"></a>{current_topic_name}\n")
        master_md_lines.append(f"### {q['num']}. {q['question']} `[{q['id']}]`\n")
        master_md_lines.append(q["answer"])
        master_md_lines.append("\n---\n")

    master_md_path = os.path.join(MD_DIR, "all_interview_questions.md")
    with open(master_md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(master_md_lines))

    # Generate topic metadata registry JSON for backend/frontend reference
    topics_meta_path = os.path.join(JSON_DIR, "topics_metadata.json")
    with open(topics_meta_path, "w", encoding="utf-8") as f:
        json.dump(topic_summaries, f, ensure_ascii=False, indent=2)

    print(f"\n✨ Unified migration complete!")
    print(f"✅ Generated {len(all_master_questions)} questions across {len(TOPIC_CONFIGS)} topics.")
    print(f"📄 Master JSON: {master_json_path}")
    print(f"📄 Master MD:   {master_md_path}")
    print(f"📄 Topics Meta: {topics_meta_path}")

if __name__ == "__main__":
    main()
