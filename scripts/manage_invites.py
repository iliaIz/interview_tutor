#!/usr/bin/env python3
"""
manage_invites.py - CLI tool to generate, list, and revoke invite codes for InterviewPrep AI.
SOTA 2026 Zero-Trust Auth Architecture.

Usage:
  python scripts/manage_invites.py create --name "Кандидат Senior" --code "SENIOR-2026-VIP"
  python scripts/manage_invites.py list
  python scripts/manage_invites.py revoke --code "SENIOR-2026-VIP"
"""

import argparse
import hashlib
import os
import sqlite3
import sys
import uuid

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_db():
    candidates = [
        os.path.join(BASE_DIR, "backend", "data", "interview.db"),
        os.path.join(BASE_DIR, "data", "interview.db"),
        os.path.join(os.getcwd(), "data", "interview.db"),
        os.path.join(os.getcwd(), "backend", "data", "interview.db"),
        os.path.join(BASE_DIR, "backend", "interview_prep.db")
    ]
    for p in candidates:
        if os.path.exists(p) and os.path.getsize(p) > 0:
            return sqlite3.connect(p)
    # Default to first
    os.makedirs(os.path.dirname(candidates[0]), exist_ok=True)
    return sqlite3.connect(candidates[0])


def hash_code(code: str) -> str:
    return hashlib.sha256(code.strip().upper().encode("utf-8")).hexdigest()

def create_invite(name: str, code: str, role: str = "candidate", max_uses: int = 0):
    conn = get_db()
    cur = conn.cursor()
    
    clean_code = code.strip().upper()
    code_h = hash_code(clean_code)
    user_id = "user_" + str(uuid.uuid4())[:8]
    invite_id = "inv_" + str(uuid.uuid4())[:8]

    # Create user
    cur.execute("""
        INSERT INTO users (id, name, role, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    """, (user_id, name, role))

    # Create invite token
    cur.execute("""
        INSERT INTO invite_tokens (id, code_hash, label, user_id, role, is_active, max_uses, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
    """, (invite_id, code_h, name, user_id, role, max_uses))

    conn.commit()
    conn.close()

    print(f"\n🎉 Инвайт-код успешно создан!")
    print(f"  👤 Пользователь: {name} (ID: {user_id}, Роль: {role})")
    print(f"  🔑 Код доступа: {clean_code}")
    print(f"  📊 Лимит использований: {'Безлимитный' if max_uses == 0 else max_uses}")
    print(f"  🛡️ SHA-256 Hash: {code_h[:12]}...")

def list_invites():
    conn = get_db()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT t.id, t.label, u.name, t.role, t.is_active, t.use_count, t.max_uses, t.created_at, t.last_used_at
        FROM invite_tokens t
        JOIN users u ON t.user_id = u.id
        ORDER BY t.created_at DESC
    """)
    rows = cur.fetchall()
    conn.close()

    if not rows:
        print("\n📭 Нет созданных инвайт-кодов.")
        return

    print(f"\n📋 Список инвайтов ({len(rows)} записей):")
    print(f"{'ID':<12} | {'Label':<25} | {'Роль':<10} | {'Статус':<10} | {'Использовано':<12} | {'Создан':<20}")
    print("-" * 100)
    for r in rows:
        status = "✅ Активен" if r[4] == 1 else "⛔ Отозван"
        uses = f"{r[5]}/{'∞' if r[6] == 0 else r[6]}"
        print(f"{r[0]:<12} | {r[1]:<25} | {r[3]:<10} | {status:<10} | {uses:<12} | {r[7]:<20}")

def revoke_invite(code: str):
    conn = get_db()
    cur = conn.cursor()
    
    clean_code = code.strip().upper()
    code_h = hash_code(clean_code)

    cur.execute("UPDATE invite_tokens SET is_active = 0 WHERE code_hash = ?", (code_h,))
    affected = cur.rowcount
    conn.commit()
    conn.close()

    if affected > 0:
        print(f"\n⛔ Инвайт-код «{clean_code}» успешно отозван!")
    else:
        print(f"\n⚠️ Инвайт-код «{clean_code}» не найден.")

def main():
    parser = argparse.ArgumentParser(description="Управление инвайт-кодами InterviewPrep AI")
    subparsers = parser.add_subparsers(dest="command", help="Команды")

    # create
    create_p = subparsers.add_parser("create", help="Создать новый инвайт-код")
    create_p.add_argument("--name", required=True, help="Имя кандидата или лейбл")
    create_p.add_argument("--code", required=True, help="Инвайт-код для входа")
    create_p.add_argument("--role", default="candidate", choices=["candidate", "mentor", "owner"], help="Роль доступа")
    create_p.add_argument("--max-uses", type=int, default=0, help="Максимальное число логинов (0 = безлимит)")

    # list
    subparsers.add_parser("list", help="Список всех инвайтов")

    # revoke
    revoke_p = subparsers.add_parser("revoke", help="Отозвать инвайт-код")
    revoke_p.add_argument("--code", required=True, help="Инвайт-код для отзыва")

    args = parser.parse_args()

    if args.command == "create":
        create_invite(args.name, args.code, args.role, args.max_uses)
    elif args.command == "list":
        list_invites()
    elif args.command == "revoke":
        revoke_invite(args.code)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
