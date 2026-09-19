#!/usr/bin/env python3
"""
run_replay.py - Convenience wrapper to generate a ticket from VPS and execute replay_turn.ts
"""

import paramiko
import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')

VPS_HOST = '192.124.182.59'
VPS_USER = 'djelu'
SSH_KEY_PATH = r'C:\Users\Djelu\.ssh\amnezia_rsa'
SSH_PASSPHRASE = 'DBshirke'

import requests

def main():
    print("🔑 Authenticating with VPS and acquiring WS ticket...")
    session = requests.Session()
    session_token = ''
    ticket = ''
    try:
        login_res = session.post("https://java.djelu.site/api/auth/login", json={"inviteCode": "SENIOR-JAVA-2026-VIP"}, timeout=10)
        if login_res.ok:
            session_token = session.cookies.get('session_token') or login_res.json().get('sessionToken') or ''
            ticket_res = session.post("https://java.djelu.site/api/auth/ws-ticket", timeout=10)
            if ticket_res.ok:
                ticket = ticket_res.json().get('ticket') or ''
    except Exception as e:
        print(f"⚠️ HTTP auth notice: {e}")

    if not ticket:
        print("🔑 Falling back to SSH for WS ticket...")
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        key = paramiko.RSAKey.from_private_key_file(SSH_KEY_PATH, password=SSH_PASSPHRASE)
        ssh.connect(VPS_HOST, username=VPS_USER, pkey=key, timeout=10)
        cmd = "docker exec interview-backend-api node -e \"const { authService } = require('./dist/services/authService'); console.log(authService.createWsTicket('user_master')); process.exit(0);\""
        _, stdout, stderr = ssh.exec_command(cmd)
        ticket = stdout.read().decode('utf-8', errors='replace').strip()
        ssh.close()

    if not ticket:
        print("❌ Failed to obtain ticket!")
        sys.exit(1)

    print(f"✅ Ticket acquired: {ticket[:10]}... Running replay...")
    cmd_replay = [
        'node', '--experimental-strip-types',
        '.agents/skills/auto-vad-diagnostics/scripts/replay_turn.ts',
        f'--ticket={ticket}',
        f'--session-token={session_token}'
    ]
    res = subprocess.run(cmd_replay)
    sys.exit(res.returncode)

if __name__ == '__main__':
    main()
