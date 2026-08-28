import sys
import paramiko

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

queries = [
    ("Distinct Models and Counts in DB", """docker exec litellm-postgres-db psql -U litellm_user -d litellm_db -c 'SELECT model_name, count(*) FROM "LiteLLM_ProxyModelTable" GROUP BY model_name ORDER BY count DESC;'"""),
    ("Distinct upstream model mappings for gemini-smart", """docker exec litellm-postgres-db psql -U litellm_user -d litellm_db -c 'SELECT model_name, litellm_params->>\\\'model\\\' as upstream_model, count(*) FROM "LiteLLM_ProxyModelTable" WHERE model_name = \\\'gemini-smart\\\' GROUP BY model_name, upstream_model;'"""),
    ("Distinct upstream model mappings for all models", """docker exec litellm-postgres-db psql -U litellm_user -d litellm_db -c 'SELECT model_name, litellm_params->>\\\'model\\\' as upstream_model, count(*) FROM "LiteLLM_ProxyModelTable" GROUP BY model_name, upstream_model ORDER BY model_name;'"""),
    ("Check LiteLLM Gateway startup script or models sync", """cat /home/djelu/LiteLLM_Proxy/gateway/init.py /home/djelu/LiteLLM_Proxy/gateway/start.sh /home/djelu/LiteLLM_Proxy/gateway/main.py 2>/dev/null || true""")
]

for title, q in queries:
    print(f"=== {title} ===")
    stdin, stdout, stderr = ssh.exec_command(q)
    out = stdout.read().decode('utf-8').strip()
    err = stderr.read().decode('utf-8').strip()
    if out:
        print(out)
    if err:
        print(f"[STDERR]: {err}")
    print()

ssh.close()
