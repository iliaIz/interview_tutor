#!/usr/bin/env python3
"""
collect_telemetry.py - Auto-VAD Quad-Vector Telemetry Triangulation Script
Connects to the VPS and extracts authoritative real-time logs, SQLite snapshot, and storage state.
"""

import paramiko
import sys
import json
import re

sys.stdout.reconfigure(encoding='utf-8')

VPS_HOST = '192.124.182.59'
VPS_USER = 'djelu'
SSH_KEY_PATH = r'C:\Users\Djelu\.ssh\amnezia_rsa'
SSH_PASSPHRASE = 'DBshirke'

def run():
    print("=" * 70)
    print("🔍 [AUTO-VAD TELEMETRY] Triangulating Evidence from VPS...")
    print("=" * 70)

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        key = paramiko.RSAKey.from_private_key_file(SSH_KEY_PATH, password=SSH_PASSPHRASE)
        ssh.connect(VPS_HOST, username=VPS_USER, pkey=key, timeout=10)
    except Exception as e:
        print(f"❌ Failed to connect to VPS: {e}")
        sys.exit(1)

    # 1. Backend Logs
    print("\n📡 [1/4] Inspecting Backend Stream Router Logs...")
    _, stdout, _ = ssh.exec_command('docker logs --tail 300 --timestamps interview-backend-api')
    backend_logs = stdout.read().decode('utf-8', errors='replace').splitlines()

    sessions = []
    current_session = {}
    
    first_audio_time = None
    client_speech_time = None
    model_turn_complete_time = None
    barge_ins = 0

    for line in backend_logs:
        if 'WS_CONNECT' in line:
            current_session = {'start': line[:30]}
        if '[MODEL_FIRST_AUDIO]' in line:
            m = re.search(r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)', line)
            if m: first_audio_time = m.group(1)
        if '[CLIENT_SPEECH_START]' in line:
            m = re.search(r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)', line)
            if m: client_speech_time = m.group(1)
        if 'Barge-in' in line or 'BARGE_IN' in line:
            barge_ins += 1

    print(f"  • Last MODEL_FIRST_AUDIO timestamp: {first_audio_time or 'None'}")
    print(f"  • Last CLIENT_SPEECH_START timestamp: {client_speech_time or 'None'}")
    print(f"  • Detected Barge-In / Interruption events: {barge_ins}")

    # 2. LiteLLM Logs
    print("\n⚡ [2/4] Inspecting LiteLLM Gateway WebSocket Sessions...")
    _, stdout, _ = ssh.exec_command('docker logs --tail 80 litellm-gateway')
    litellm_logs = stdout.read().decode('utf-8', errors='replace').splitlines()
    for line in litellm_logs[-15:]:
        if any(k in line for k in ['WebSocket', 'upstream', 'disconnect', 'mapped']):
            print(f"  {line.strip()}")

    # 3. SQLite DB Snapshot
    print("\n💾 [3/4] Inspecting Latest Evaluation Record in SQLite (/home/djelu/spring/data/interview.db)...")
    py_sql = "python3 -c \"import sqlite3, json; conn = sqlite3.connect('/home/djelu/spring/data/interview.db'); c = conn.cursor(); cols = [col[1] for col in c.execute('PRAGMA table_info(question_evaluations)').fetchall()]; row = c.execute('SELECT * FROM question_evaluations ORDER BY created_at DESC LIMIT 1').fetchone(); print(json.dumps(dict(zip(cols, row)), ensure_ascii=False) if row else 'null')\""
    _, stdout, stderr = ssh.exec_command(py_sql)
    eval_raw = stdout.read().decode('utf-8', errors='replace').strip()
    eval_err = stderr.read().decode('utf-8', errors='replace').strip()
    try:
        eval_data = json.loads(eval_raw)
        if eval_data:
            print(f"  • Evaluation ID: {eval_data.get('id')}")
            print(f"  • Question: {eval_data.get('question_id')} ({eval_data.get('topic')})")
            print(f"  • Score: {eval_data.get('score')} / 100")
            print(f"  • Created At: {eval_data.get('created_at')}")
            print(f"  • Audio Path: {eval_data.get('audio_path') or '❌ NULL (Not Saved!)'}")
            
            transcript = eval_data.get('transcript')
            if transcript:
                try:
                    turns = json.loads(transcript)
                    ai_turns = [t for t in turns if t.get('role') == 'ai']
                    user_turns = [t for t in turns if t.get('role') == 'user']
                    print(f"  • Transcript Structure: {len(turns)} total turns ({len(ai_turns)} AI, {len(user_turns)} User)")
                    if len(ai_turns) == 0:
                        print("    ⚠️ ALERT: 0 AI turns recorded in transcript! Protocol asymmetry detected.")
                except Exception:
                    print(f"  • Raw transcript length: {len(transcript)} chars")

            turn_telemetry_raw = eval_data.get('turn_telemetry')
            if turn_telemetry_raw:
                try:
                    tt_list = json.loads(turn_telemetry_raw) if isinstance(turn_telemetry_raw, str) else turn_telemetry_raw
                    print(f"\n  📊 [Canonical Turn Telemetry] ({len(tt_list)} turns recorded):")
                    for t in tt_list:
                        idx = t.get('turnIndex', '?')
                        ttfr = f"{t.get('ttfrMs')}ms" if t.get('ttfrMs') is not None else "-"
                        ttft = f"{t.get('ttftMs')}ms" if t.get('ttftMs') is not None else "-"
                        ttfa = f"{t.get('ttfaMs')}ms" if t.get('ttfaMs') is not None else "-"
                        ttfp = f"{t.get('ttfpMs')}ms" if t.get('ttfpMs') is not None else "-"
                        skew = f"{t.get('audioTextSkewMs')}ms" if t.get('audioTextSkewMs') is not None else "-"
                        echo = f"{t.get('echoLeakageDroppedMs', 0)}ms"
                        dur = f"{t.get('speechDurationMs', 0)}ms"
                        print(f"    • Turn #{idx} | User Speech: {dur} | TTFR: {ttfr} | TTFT: {ttft} | TTFA: {ttfa} | TTFP: {ttfp} | Skew: {skew} | Echo: {echo}")
                except Exception as ex:
                    print(f"    ⚠️ Could not parse turn_telemetry JSON: {ex}")
    except Exception as e:
        print(f"  Could not parse SQLite record: {e}")
        if eval_err:
            print(f"  Remote stderr: {eval_err}")
        if eval_raw:
            print(f"  Remote stdout: {eval_raw[:200]}")

    # 4. Storage Directory
    print("\n📁 [4/4] Inspecting Physical Audio Storage (/home/djelu/spring/storage)...")
    _, stdout, _ = ssh.exec_command('ls -la /home/djelu/spring/storage')
    ls_out = stdout.read().decode('utf-8', errors='replace').strip().splitlines()
    files = [f for f in ls_out if not f.endswith('.') and not f.endswith('..') and not f.startswith('total')]
    print(f"  • Files in storage: {len(files)}")
    for f in files[:5]:
        print(f"    - {f}")
    if len(files) == 0:
        print("  ⚠️ ALERT: Storage directory is completely empty.")

    ssh.close()
    print("\n" + "=" * 70)
    print("✅ [AUTO-VAD TELEMETRY] Triangulation Complete.")
    print("=" * 70)

if __name__ == '__main__':
    run()
