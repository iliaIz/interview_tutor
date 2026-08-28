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

system_instruction = """You are a Principal Java 21 Architect and Lead Interviewer.
Evaluate the code submission and return JSON adhering to:
{
  "compilationStatus": {"isCompilable": true, "syntaxErrors": []},
  "virtualExecutionResult": {
    "passCount": 2, "failCount": 0,
    "testCases": [{"testName": "TC1", "status": "PASSED", "inputData": "allow(user1)", "expectedOutput": "true", "actualVirtualOutput": "true", "failureReason": ""}]
  },
  "concurrencyAnalysis": {"hasRaceConditions": false, "hasJmmVisibilityIssues": false, "hasCarrierThreadPinning": false, "findings": []},
  "architecturalCompliance": {"isSolidCompliant": true, "springBootBestPracticesViolations": [], "modernJava21IdiomAdoption": ["Records"]},
  "scoreBreakdown": {
    "correctnessScore": 90, "concurrencyScore": 85, "architectureScore": 90, "modernIdiomsScore": 80, "overallScore": 87,
    "summaryReview": "Отличная реализация Token Bucket с ленивым пополнением."
  }
}
"""

user_prompt = """Challenge: In-Memory Rate Limiter (Token Bucket)
Target Stack: Java 21 LTS, Concurrency Primitives

Candidate Workspace Code:
package com.assessment.ratelimiter.service;
import com.assessment.ratelimiter.contract.RateLimiterStrategy;
import com.assessment.ratelimiter.model.TokenBucket;
import java.util.concurrent.ConcurrentHashMap;
public class TokenBucketStrategy implements RateLimiterStrategy {
  private final ConcurrentHashMap<String, TokenBucket> buckets = new ConcurrentHashMap<>();
  public boolean tryAcquire(String clientId, int tokens) {
    return true;
  }
  public void updateLimits(long c, double r) {}
}
"""

for model in ["gemini-fast", "gemini-smart"]:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_prompt}
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
        "max_tokens": 3000
    }

    payload_json = json.dumps(payload).replace("'", "'\\''")

    cmd = f"""docker exec interview-backend-api curl -s -X POST http://litellm-gateway:4000/v1/chat/completions \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer sk-litellm-local-proxy-master-key-12345" \
      -d '{payload_json}'
    """

    t0 = time.time()
    _, out, err = ssh.exec_command(cmd)
    res_text = out.read().decode('utf-8')
    dt = time.time() - t0

    print(f"=== Model [{model}] ===")
    print(f"Elapsed Time: {dt:.2f}s")
    try:
        data = json.loads(res_text)
        content = data.get("choices", [{}])[0].get("message", {}).get("content")
        print("Content sample:", content[:150] if content else "EMPTY CONTENT")
    except Exception as e:
        print("Error parsing response:", e)
    print()

ssh.close()
