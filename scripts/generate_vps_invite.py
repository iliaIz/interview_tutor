#!/usr/bin/env python3
"""
generate_vps_invite.py - Connects to VPS and generates a personal VIP invite code in the remote SQLite database.
"""

import os
import sys
import paramiko
import hashlib
import uuid

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

KEY_PATH = r"C:\Users\Admin\.ssh\amnezia_rsa"
PASSPHRASE = "DBshirke"
HOSTNAME = "192.124.182.59"
USERNAME = "djelu"
REMOTE_PATH = "/home/djelu/spring"

def generate_invite_on_vps(invite_code="SPRING-VIP-OWNER-2026", user_name="Владелец Платформы (VIP)"):
    print(f"🔑 Generating VIP Invite Code on VPS ({HOSTNAME})...")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    pkey = paramiko.RSAKey.from_private_key_file(KEY_PATH, password=PASSPHRASE)
    ssh.connect(HOSTNAME, username=USERNAME, pkey=pkey, timeout=15)
    print("✓ SSH connection established!")

    clean_code = invite_code.strip().upper()
    code_hash = hashlib.sha256(clean_code.encode("utf-8")).hexdigest()
    user_id = "user_owner_" + str(uuid.uuid4())[:6]
    invite_id = "inv_owner_" + str(uuid.uuid4())[:6]

    script_content = f"""import sqlite3, os

candidates = [
    '{REMOTE_PATH}/backend/data/interview.db',
    '{REMOTE_PATH}/data/interview.db',
    '{REMOTE_PATH}/backend/interview.db'
]

db_path = None
for p in candidates:
    if os.path.exists(p) and os.path.getsize(p) > 0:
        db_path = p
        break

if not db_path:
    db_path = candidates[0]
    os.makedirs(os.path.dirname(db_path), exist_ok=True)

conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Ensure tables exist
cur.execute('''CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'candidate',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME
)''')

cur.execute('''CREATE TABLE IF NOT EXISTS invite_tokens (
    id TEXT PRIMARY KEY,
    code_hash TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'candidate',
    is_active INTEGER DEFAULT 1,
    max_uses INTEGER DEFAULT 0,
    use_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME
)''')

# Insert or update Owner User
cur.execute('''
    INSERT OR REPLACE INTO users (id, name, role)
    VALUES ('{user_id}', '{user_name}', 'owner')
''')

# Insert or update Invite Token
cur.execute('''
    INSERT OR REPLACE INTO invite_tokens (id, code_hash, label, user_id, role, is_active, max_uses)
    VALUES ('{invite_id}', '{code_hash}', '{user_name}', '{user_id}', 'owner', 1, 0)
''')

conn.commit()

# List all active codes
cur.execute('''
    SELECT t.id, t.label, u.name, t.role, t.is_active, t.use_count, t.created_at
    FROM invite_tokens t
    JOIN users u ON t.user_id = u.id
''')
rows = cur.fetchall()
conn.close()

print(f"SUCCESS: Inserted invite code '{clean_code}' into " + db_path)
print(f"ACTIVE_INVITES_COUNT: " + str(len(rows)))
for r in rows:
    print("  - [" + str(r[0]) + "] " + str(r[1]) + " (Role: " + str(r[3]) + ", Active: " + str(bool(r[4])) + ")")
"""

    sftp = ssh.open_sftp()
    remote_script_path = f"/tmp/gen_invite.py"
    with sftp.file(remote_script_path, "w") as f:
        f.write(script_content)
    sftp.close()

    stdin, stdout, stderr = ssh.exec_command(f"python3 {remote_script_path} && rm -f {remote_script_path}")
    out = stdout.read().decode("utf-8")
    err = stderr.read().decode("utf-8")

    print(out)
    if err and "warning" not in err.lower():
        print(f"[STDERR]: {err}")

    ssh.close()
    return clean_code

if __name__ == "__main__":
    code = sys.argv[1] if len(sys.argv) > 1 else "SPRING-VIP-OWNER-2026"
    generate_invite_on_vps(code)
