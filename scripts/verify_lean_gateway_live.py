import sys
import json
import httpx
import asyncio

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Virtual key generated earlier or master key
# In .env: LITELLM_MASTER_KEY
MASTER_KEY = "sk-litellm-local-proxy-master-key-12345"
VIRTUAL_KEY = "3a060b787de1df2a68f089bd2e70133781e1241117dd836ea478fcc7425871e3"

# Direct URL to gateway via SSH port forward or public HTTPS
BASE_URL = "https://ai.djelu.site"

headers_master = {"Authorization": f"Bearer {MASTER_KEY}"}
headers_auth = {"Authorization": f"Bearer sk-interview-training"}

async def run_live_verifications():
    # We can connect directly inside the VPS via SSH command or via httpx with Basic Auth + Bearer
    print("=== 1. Testing GET /v1/models via SSH on VPS ===")
    import paramiko
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    pkey = paramiko.RSAKey.from_private_key_file(r'C:\Users\Admin\.ssh\amnezia_rsa', password='DBshirke')
    ssh.connect(hostname='192.124.182.59', username='djelu', pkey=pkey, timeout=10)

    # Test 1: GET /v1/models
    cmd_models = 'curl -s -H "Authorization: Bearer sk-litellm-local-proxy-master-key-12345" http://127.0.0.1:4000/v1/models'
    _, o, _ = ssh.exec_command(cmd_models)
    models_res = o.read().decode('utf-8')
    print("Models response snippet:\n", models_res[:300])

    # Test 2: Non-streaming chat completion
    print("\n=== 2. Testing Non-streaming /v1/chat/completions ===")
    chat_payload = {
        "model": "gemini-smart",
        "messages": [
            {"role": "user", "content": "Hello, please reply with Lean Gateway is Alive!"}
        ]
    }
    cmd_chat = f"""curl -s -X POST http://127.0.0.1:4000/v1/chat/completions \\
        -H "Content-Type: application/json" \\
        -H "Authorization: Bearer sk-litellm-local-proxy-master-key-12345" \\
        -d '{json.dumps(chat_payload)}'"""
    _, o, e = ssh.exec_command(cmd_chat)
    chat_res = o.read().decode('utf-8')
    print("Chat response:\n", chat_res[:500])

    # Test 3: Streaming chat completion
    print("\n=== 3. Testing Streaming /v1/chat/completions ===")
    stream_payload = {
        "model": "gemini-smart",
        "stream": True,
        "messages": [
            {"role": "user", "content": "Count from 1 to 3"}
        ]
    }
    cmd_stream = f"""curl -s -N -X POST http://127.0.0.1:4000/v1/chat/completions \\
        -H "Content-Type: application/json" \\
        -H "Authorization: Bearer sk-litellm-local-proxy-master-key-12345" \\
        -d '{json.dumps(stream_payload)}'"""
    _, o, e = ssh.exec_command(cmd_stream)
    stream_res = o.read().decode('utf-8')
    print("Stream chunks snippet:\n", stream_res[:400])

    # Test 4: Tool Calling / Function Calling
    print("\n=== 4. Testing Function Calling (submit_interview_evaluation) ===")
    tools_payload = {
        "model": "gemini-smart",
        "messages": [
            {"role": "system", "content": "You are an interviewer. Call submit_interview_evaluation to grade candidate."},
            {"role": "user", "content": "My answer is: ConcurrentHashMap locks individual table buckets."}
        ],
        "tools": [
            {
                "type": "function",
                "function": {
                    "name": "submit_interview_evaluation",
                    "description": "Submit score",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "score": {"type": "integer"},
                            "feedback": {"type": "string"}
                        },
                        "required": ["score", "feedback"]
                    }
                }
            }
        ]
    }
    cmd_tools = f"""curl -s -X POST http://127.0.0.1:4000/v1/chat/completions \\
        -H "Content-Type: application/json" \\
        -H "Authorization: Bearer sk-litellm-local-proxy-master-key-12345" \\
        -d '{json.dumps(tools_payload)}'"""
    _, o, e = ssh.exec_command(cmd_tools)
    tools_res = o.read().decode('utf-8')
    print("Function Call response:\n", tools_res[:600])

    # Test 5: Embeddings
    print("\n=== 5. Testing /v1/embeddings ===")
    embed_payload = {
        "model": "gemini-embedding",
        "input": "Spring Framework IoC Container"
    }
    cmd_embed = f"""curl -s -X POST http://127.0.0.1:4000/v1/embeddings \\
        -H "Content-Type: application/json" \\
        -H "Authorization: Bearer sk-litellm-local-proxy-master-key-12345" \\
        -d '{json.dumps(embed_payload)}'"""
    _, o, e = ssh.exec_command(cmd_embed)
    embed_res = o.read().decode('utf-8')
    print("Embeddings response snippet:\n", embed_res[:400])

    # Test 6: Audio Speech
    print("\n=== 6. Testing /v1/audio/speech ===")
    speech_payload = {
        "model": "tts-v3",
        "input": "Привет, шлюз работает отлично!",
        "voice": "Kore"
    }
    cmd_speech = f"""curl -s -o /tmp/speech_test.wav -w "%{{http_code}} bytes: %{{size_download}}" -X POST http://127.0.0.1:4000/v1/audio/speech \\
        -H "Content-Type: application/json" \\
        -H "Authorization: Bearer sk-litellm-local-proxy-master-key-12345" \\
        -d '{json.dumps(speech_payload)}'"""
    _, o, e = ssh.exec_command(cmd_speech)
    speech_res = o.read().decode('utf-8')
    print("Audio Speech result:\n", speech_res)

    # Test 7: Dashboard Web UI via Caddy (localhost:4000 and ai.djelu.site)
    print("\n=== 7. Testing Dashboard UI endpoint ===")
    cmd_ui = 'curl -s -I http://127.0.0.1:4000/'
    _, o, _ = ssh.exec_command(cmd_ui)
    ui_res = o.read().decode('utf-8')
    print("Dashboard UI HTTP Header:\n", ui_res)

    ssh.close()

if __name__ == "__main__":
    asyncio.run(run_live_verifications())
