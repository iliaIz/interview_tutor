#!/usr/bin/env python3
"""
🎓 Утилита-Тренажер для работы с базой вопросов/ответов (Java Core, Spring, Hibernate, Docker)
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

def load_questions(topic=None):
    if not os.path.exists(MASTER_JSON):
        print(f"❌ Ошибка: Файл {MASTER_JSON} не найден.")
        return []
    with open(MASTER_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    if topic:
        topic_lower = topic.lower()
        data = [q for q in data if topic_lower in q["topic"].lower()]
    return data

def run_interactive_flashcards(questions):
    print(f"\n🎓 ИНТЕРАКТИВНЫЙ ТРЕНАЖЕР ({len(questions)} вопросов)\n" + "="*60)
    for idx, q in enumerate(questions, 1):
        print(f"\nВопрос [{idx}/{len(questions)}] (ID: {q['id']}) [{q['topic']}]:")
        print(f"👉 {q['question']}\n")
        input("Press Enter to show answer...")
        print("-" * 60)
        print("💡 ОТВЕТ:")
        print(q["answer"])
        print("=" * 60)
        if idx < len(questions):
            cont = input("\nНажмите Enter для следующего вопроса (или 'q' для выхода): ")
            if cont.lower() == 'q':
                break

def show_interactive_menu():
    print("\n" + "="*60)
    print(" 🚀 ИНТЕРАКТИВНЫЙ ТРЕНАЖЕР К СОБЕСЕДОВАНИЮ")
    print("="*60)
    print("Выберите тему:")
    print("  1) Все темы (405 вопросов)")
    print("  2) Java Core (240 вопросов)")
    print("  3) Spring Framework (75 вопросов)")
    print("  4) Hibernate ORM (60 вопросов)")
    print("  5) Docker (30 вопросов)")
    print("  q) Выход")
    
    topic_choice = input("\nВведите номер темы (1-5): ").strip()
    topic_map = {"1": None, "2": "java", "3": "spring", "4": "hibernate", "5": "docker"}
    if topic_choice.lower() == "q" or topic_choice not in topic_map:
        return
        
    topic = topic_map[topic_choice]
    questions = load_questions(topic)
    
    print("\nВыберите режим:")
    print("  1) Первые 20 вопросов по порядку")
    print("  2) 10 случайных вопросов")
    print("  3) Интерактивные карточки (Flashcards)")
    print("  4) Свой диапазон номеров (например, с 1 по 30)")
    
    mode = input("\nВведите номер режима (1-4): ").strip()
    
    if mode == "1":
        res = questions[:20]
        print(f"\n📋 ПЕРВЫЕ {len(res)} ВОПРОСОВ:\n" + "="*60)
        for q in res:
            print(f"[{q['id']}] ({q['topic']} #{q['num']}): {q['question']}")
    elif mode == "2":
        res = random.sample(questions, min(10, len(questions)))
        print(f"\n🎲 10 СЛУЧАЙНЫХ ВОПРОСОВ:\n" + "="*60)
        for q in res:
            print(f"[{q['id']}] ({q['topic']} #{q['num']}): {q['question']}")
    elif mode == "3":
        random.shuffle(questions)
        run_interactive_flashcards(questions[:15])
    elif mode == "4":
        try:
            start = int(input("Стартовый номер (например 1): "))
            end = int(input("Конечный номер (например 20): "))
            res = [q for q in questions if start <= q["num"] <= end]
            print(f"\n📋 ВОПРОСЫ С №{start} ПО №{end} ({len(res)} шт.):\n" + "="*60)
            for q in res:
                print(f"[{q['id']}] ({q['topic']} #{q['num']}): {q['question']}")
        except ValueError:
            print("Ошибка: введен нечисловой номер.")

def main():
    if len(sys.argv) == 1:
        show_interactive_menu()
        return

    parser = argparse.ArgumentParser(description="Автоматизация работы с базой вопросов без ИИ.")
    parser.add_argument("--topic", type=str, choices=["java", "spring", "hibernate", "docker"], help="Фильтр по теме")
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

    print(f"\n📋 ВЫБОРКА ВОПРОСОВ ({len(result)} штук)\n" + "="*60)
    for q in result:
        print(f"[{q['id']}] ({q['topic']} #{q['num']}): {q['question']}")

if __name__ == "__main__":
    main()
