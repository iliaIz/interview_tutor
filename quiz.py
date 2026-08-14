#!/usr/bin/env python3
"""
🎓 Консольный Тренажер для работы с актуальной базой вопросов Java Developer (694+ вопросов, 22 темы)
"""
import os
import sys
import json
import random
import argparse

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_DIR = os.path.join(BASE_DIR, "json")
MASTER_JSON = os.path.join(JSON_DIR, "all_interview_questions.json")
TOPICS_META_JSON = os.path.join(JSON_DIR, "topics_metadata.json")

def load_topics_meta():
    if os.path.exists(TOPICS_META_JSON):
        with open(TOPICS_META_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def load_questions(topic_query=None):
    if not os.path.exists(MASTER_JSON):
        print(f"❌ Ошибка: Файл {MASTER_JSON} не найден.")
        return []
    with open(MASTER_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    if topic_query:
        query_lower = topic_query.lower().strip()
        # Find matching topic by slug or by name substring
        topics_meta = load_topics_meta()
        target_name = None
        for t in topics_meta:
            if t["id"].lower() == query_lower or query_lower in t["name"].lower():
                target_name = t["name"]
                break

        if target_name:
            data = [q for q in data if q["topic"] == target_name]
        else:
            data = [q for q in data if query_lower in q["topic"].lower()]
            
    return data

def run_interactive_flashcards(questions):
    print(f"\n🎓 ИНТЕРАКТИВНЫЙ ТРЕНАЖЕР ({len(questions)} вопросов)\n" + "="*65)
    for idx, q in enumerate(questions, 1):
        print(f"\nВопрос [{idx}/{len(questions)}] (ID: {q['id']}) [{q['topic']}]:")
        print(f"👉 {q['question']}\n")
        input("Press Enter to show answer...")
        print("-" * 65)
        print("💡 ОТВЕТ:")
        print(q["answer"])
        print("=" * 65)
        if idx < len(questions):
            cont = input("\nНажмите Enter для следующего вопроса (или 'q' для выхода): ")
            if cont.lower() == 'q':
                break

def show_interactive_menu():
    topics_meta = load_topics_meta()
    all_qs = load_questions()

    print("\n" + "="*65)
    print(f" 🚀 ИНТЕРАКТИВНЫЙ ТРЕНАЖЕР К СОБЕСЕДОВАНИЮ ({len(all_qs)} вопросов)")
    print("="*65)
    print("  0) 🔥 Все разделы базы знаний (694 вопроса)")
    
    current_cat = None
    for idx, t in enumerate(topics_meta, 1):
        if t.get("category") != current_cat:
            current_cat = t.get("category")
            print(f"\n  --- {current_cat} ---")
        print(f"  {idx:2d}) {t['name']:32s} ({t['count']:2d} вопр.) [{t['id']}]")

    print("\n  q) Выход")
    
    choice = input("\nВведите номер раздела (0-22) или slug: ").strip()
    if choice.lower() == "q":
        return

    selected_topic_name = None
    if choice == "0":
        questions = all_qs
        selected_topic_name = "Все разделы"
    elif choice.isdigit() and 1 <= int(choice) <= len(topics_meta):
        t_meta = topics_meta[int(choice) - 1]
        selected_topic_name = t_meta["name"]
        questions = [q for q in all_qs if q["topic"] == selected_topic_name]
    else:
        # Try matching by slug or query
        questions = load_questions(choice)
        selected_topic_name = choice

    if not questions:
        print("❌ Раздел не найден или пуст.")
        return

    print(f"\nВыбран раздел: {selected_topic_name} ({len(questions)} вопросов)")
    print("\nВыберите режим:")
    print("  1) Первые 20 вопросов по порядку")
    print("  2) 10 случайных вопросов")
    print("  3) Интерактивные карточки (Flashcards)")
    print("  4) Свой диапазон номеров (например, с 1 по 30)")
    
    mode = input("\nВведите номер режима (1-4): ").strip()
    
    if mode == "1":
        res = questions[:20]
        print(f"\n📋 ПЕРВЫЕ {len(res)} ВОПРОСОВ:\n" + "="*65)
        for q in res:
            print(f"[{q['id']}] ({q['topic']} #{q['num']}): {q['question']}")
    elif mode == "2":
        res = random.sample(questions, min(10, len(questions)))
        print(f"\n🎲 10 СЛУЧАЙНЫХ ВОПРОСОВ:\n" + "="*65)
        for q in res:
            print(f"[{q['id']}] ({q['topic']} #{q['num']}): {q['question']}")
    elif mode == "3":
        shuffled = list(questions)
        random.shuffle(shuffled)
        run_interactive_flashcards(shuffled[:15])
    elif mode == "4":
        try:
            start = int(input("Стартовый номер (например 1): "))
            end = int(input("Конечный номер (например 20): "))
            res = [q for q in questions if start <= q["num"] <= end]
            print(f"\n📋 ВОПРОСЫ С №{start} ПО №{end} ({len(res)} шт.):\n" + "="*65)
            for q in res:
                print(f"[{q['id']}] ({q['topic']} #{q['num']}): {q['question']}")
        except ValueError:
            print("Ошибка: введен нечисловой номер.")

def main():
    if len(sys.argv) == 1:
        show_interactive_menu()
        return

    parser = argparse.ArgumentParser(description="Консольный тренажер базы вопросов Java Interview.")
    parser.add_argument("--topic", type=str, help="Фильтр по теме (slug, например: core, jcf, concurrency, kafka, sql)")
    parser.add_argument("--random", action="store_true", help="Получить случайный вопрос")
    parser.add_argument("--range", nargs=2, type=int, metavar=("START", "END"), help="Диапазон номеров (например, --range 1 20)")
    parser.add_argument("--limit", type=int, default=20, help="Количество вопросов (по умолчанию 20)")
    parser.add_argument("--interactive", action="store_true", help="Интерактивный режим тренажера (Flashcards)")
    parser.add_argument("--export-json", type=str, help="Сохранить результат выборки в отдельный JSON файл")

    args = parser.parse_args()

    questions = load_questions(args.topic)
    if not questions:
        print("Вопросы не найдены.")
        return

    result = questions
    if args.range:
        start, end = args.range
        result = [q for q in result if start <= q["num"] <= end]
    elif args.random:
        if args.interactive:
            result = [random.choice(questions)]
        else:
            random.shuffle(result)
            result = result[:args.limit]
    else:
        result = result[:args.limit]

    if args.interactive:
        run_interactive_flashcards(result)
        return

    if args.export_json:
        with open(args.export_json, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"✅ Успешно экспортировано {len(result)} вопросов в файл: {args.export_json}")
        return

    print(f"\n📋 ВЫБОРКА ВОПРОСОВ ({len(result)} штук)\n" + "="*65)
    for q in result:
        print(f"[{q['id']}] ({q['topic']} #{q['num']}): {q['question']}")

if __name__ == "__main__":
    main()
