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

commands = [
    ("List gateway directory", "ls -la /home/djelu/LiteLLM_Proxy/gateway"),
    ("Gateway files content", "cat /home/djelu/LiteLLM_Proxy/gateway/* 2>/dev/null || true"),
    ("Query Models in LiteLLM DB", "docker exec litellm-postgres-db psql -U litellm_user -d litellm_db -c 'SELECT model_name, litellm_params FROM \"LiteLLM_ProxyModelTable\";'"),
    ("Query Router Model Info", "docker exec litellm-postgres-db psql -U litellm_user -d litellm_db -c 'SELECT model_id, model_name, model_info FROM \"LiteLLM_ProxyModelTable\";'")
]

for title, cmd in commands:
    print(f"=== {title} ===")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8').strip()
    err = stderr.read().decode('utf-8').strip()
    if out:
        print(out)
    if err:
        print(f"[STDERR]: {err}")
    print()

ssh.close()
