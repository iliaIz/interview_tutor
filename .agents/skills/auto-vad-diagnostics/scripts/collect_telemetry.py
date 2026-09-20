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

    # 5. Diagnostic Decision Matrix Analysis
    print("\n🎯 [5/5] Executing Auto-VAD Diagnostic Decision Matrix...")
    diagnosis = diagnose_session(eval_data, backend_logs, litellm_logs, files)
    print(f"  • Severity: {diagnosis['severity']}")
    print(f"  • Classification: {diagnosis['classification']} ({diagnosis['title']})")
    print(f"  • Explanation: {diagnosis['explanation']}")
    print(f"  • Prescribed Fix: {diagnosis['prescribed_fix']}")

    ssh.close()
    print("\n" + "=" * 70)
    print("✅ [AUTO-VAD TELEMETRY] Triangulation Complete.")
    print("=" * 70)

def diagnose_session(eval_data, backend_logs, litellm_logs, storage_files):
    if not eval_data:
        return {
            'severity': 'UNKNOWN',
            'classification': 'NO_DATA',
            'title': 'No Evaluation Data Found',
            'explanation': 'No SQLite evaluation record found in database.',
            'prescribed_fix': 'Run a test interview session first.'
        }

    turns = []
    tt_raw = eval_data.get('turn_telemetry')
    if tt_raw:
        try:
            turns = json.loads(tt_raw) if isinstance(tt_raw, str) else tt_raw
        except Exception:
            turns = []

    transcript_turns = []
    tr_raw = eval_data.get('transcript')
    if tr_raw:
        try:
            transcript_turns = json.loads(tr_raw) if isinstance(tr_raw, str) else tr_raw
        except Exception:
            transcript_turns = []

    ai_turns = [t for t in transcript_turns if t.get('role') == 'ai']
    user_turns = [t for t in transcript_turns if t.get('role') == 'user']

    # 1. Protocol Asymmetry
    if len(user_turns) > 0 and len(ai_turns) == 0:
        return {
            'severity': 'CRITICAL',
            'classification': 'PROTOCOL_ASYMMETRY',
            'title': 'Protocol Asymmetry Detected',
            'explanation': 'Candidate turns exist, but 0 AI turns recorded. Model transcript was never received.',
            'prescribed_fix': 'Ensure outputAudioTranscription: {} is declared in setupMessage.setup.'
        }

    # 2. Upstream Sever
    all_logs = (backend_logs or []) + (litellm_logs or [])
    if any(code in line for line in all_logs for code in ['1001', '1005', '1006']) and len(turns) == 0:
        return {
            'severity': 'CRITICAL',
            'classification': 'UPSTREAM_GATEWAY_SEVER',
            'title': 'Upstream Gateway Sever',
            'explanation': 'WebSocket connection terminated prematurely with code 1001/1005/1006.',
            'prescribed_fix': 'Check LiteLLM Proxy upstream key pool and model rate limits (429).'
        }

    # 3. Storage Pipeline Void
    if len(user_turns) > 0 and not eval_data.get('audio_path') and len(storage_files) == 0:
        return {
            'severity': 'CRITICAL',
            'classification': 'STORAGE_PIPELINE_VOID',
            'title': 'Storage Pipeline Void',
            'explanation': 'Audio was processed, but no recording was written to disk (/app/storage is empty).',
            'prescribed_fix': 'Verify that writeToDisk executes and updates audio_path in SQLite.'
        }

    # 4. Browser Autoplay Barrier
    for t in turns:
        if t.get('speaker') == 'model':
            ttfa = t.get('ttfaMs')
            ttfp = t.get('ttfpMs')
            if ttfa is not None and ttfa < 800 and (ttfp is None or ttfp > 4000):
                return {
                    'severity': 'CRITICAL',
                    'classification': 'BROWSER_AUTOPLAY_BARRIER',
                    'title': 'Browser Web Audio Autoplay Barrier',
                    'explanation': f'First audio packet arrived in {ttfa}ms, but DAC playback delayed to {ttfp}ms (> 4000ms).',
                    'prescribed_fix': 'Prime AudioContext synchronously inside user DOM onClick before any await boundary.'
                }

    # 5. Subtitle Spoilering
    for t in turns:
        skew = t.get('audioTextSkewMs')
        if skew is not None and skew < -800:
            return {
                'severity': 'WARNING',
                'classification': 'SUBTITLE_SPOILER',
                'title': 'Negative Playout Skew (Subtitle Spoilering)',
                'explanation': f'Audio-Text Skew was {skew}ms (< -800ms). Subtitles rendered ahead of audio playout.',
                'prescribed_fix': 'Apply subtitle pacing aligned with AudioPlayoutManager timeline drain.'
            }

    # 6. Upstream AI Latency
    for t in turns:
        ttfa = t.get('ttfaMs')
        rtt = t.get('networkRttMs') or 20
        if ttfa is not None and ttfa > 4000 and rtt < 60:
            return {
                'severity': 'CRITICAL',
                'classification': 'UPSTREAM_AI_LATENCY',
                'title': 'Upstream Model Latency Spike',
                'explanation': f'TTFA was {ttfa}ms (> 4000ms) despite normal network RTT ({rtt}ms).',
                'prescribed_fix': 'Inspect Gemini Live queue saturation on LiteLLM Proxy.'
            }

    # 7. Acoustic Speaker Bleed
    for t in turns:
        echo = t.get('echoLeakageDroppedMs', 0)
        if echo > 3000:
            return {
                'severity': 'WARNING',
                'classification': 'ACOUSTIC_SPEAKER_BLEED',
                'title': 'Acoustic Speaker Bleed',
                'explanation': f'Half-duplex guard dropped {echo}ms of mic frames while AI was speaking.',
                'prescribed_fix': 'Prompt candidate to wear headphones.'
            }

    # 8. Premature VAD Endpointing
    for t in turns:
        if t.get('speaker') == 'user':
            dur = t.get('speechDurationMs', 0)
            if 0 < dur < 800:
                return {
                    'severity': 'WARNING',
                    'classification': 'PREMATURE_VAD_ENDPOINTING',
                    'title': 'Premature VAD Endpointing',
                    'explanation': f'Candidate speech was cut off after only {dur}ms (< 800ms).',
                    'prescribed_fix': 'Increase VAD pause gate from 1200ms to 1800ms-2200ms.'
                }

    return {
        'severity': 'HEALTHY',
        'classification': 'HEALTHY',
        'title': 'Acoustic Stack Healthy',
        'explanation': 'All turn telemetry, transcript integrity, and storage checks passed.',
        'prescribed_fix': 'No remediation needed.'
    }

if __name__ == '__main__':
    run()
