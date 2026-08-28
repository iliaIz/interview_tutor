import sys
import paramiko
import json
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

KEY_PATH = r"C:\Users\Admin\.ssh\amnezia_rsa"
PASSPHRASE = "DBshirke"
HOSTNAME = "192.124.182.59"
USERNAME = "djelu"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
pkey = paramiko.RSAKey.from_private_key_file(KEY_PATH, password=PASSPHRASE)
ssh.connect(hostname=HOSTNAME, username=USERNAME, pkey=pkey, timeout=10)

system_instruction = """You are a Principal Java 21 Architect. Evaluate this code and return JSON:
{
  "score": 90,
  "summaryReview": "Review summary"
}"""

user_prompt = "Code: public class TokenBucketStrategy { public boolean tryAcquire() { return true; } }"

# Tests with different parameters
test_cases = [
    ("Default gemini-smart", {"model": "gemini-smart"}),
    ("gemini-smart with thinking disabled (budget=0)", {
        "model": "gemini-smart",
        "extra_body": {
            "generation_config": {"thinking_config": {"thinking_budget": 0}}
        }
    }),
    ("gemini-smart with thinking_budget=1024", {
        "model": "gemini-smart",
        "extra_body": {
            "generation_config": {"thinking_config": {"thinking_budget": 1024}}
        }
    }),
    ("gemini-3.7-flash direct (if available in LiteLLM)", {"model": "gemini-3.7-flash"})
]

for name, params in test_cases:
    payload = {
        "messages": [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_prompt}
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
        "max_tokens": 2048,
        **params
    }

    payload_json = json.dumps(payload).replace("'", "'\\''")

    cmd = f"""docker exec interview-backend-api curl -s -X POST http://litellm-gateway:4000/v1/chat/completions \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer sk-litellm-local-proxy-master-key-12345" \
      -d '{payload_json}'
    """

    print(f"=== Testing: {name} ===")
    t0 = time.time()
    _, out, err = ssh.exec_command(cmd)
    res_text = out.read().decode('utf-8')
    dt = time.time() - t0
    print(f"Time: {dt:.2f}s")
    try:
        data = json.loads(res_text)
        content = data.get("choices", [{}])[0].get("message", {}).get("content")
        usage = data.get("usage", {})
        print("Usage:", usage)
        print("Content:", content)
    except Exception as e:
        print("Raw output:", res_text[:200])
    print()

ssh.close()
