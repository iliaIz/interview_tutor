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
    ("List LiteLLM_Proxy directory", "ls -la /home/djelu/LiteLLM_Proxy"),
    ("LiteLLM config file (or similar)", "cat /home/djelu/LiteLLM_Proxy/config.yaml || cat /home/djelu/LiteLLM_Proxy/litellm_config.yaml || cat /home/djelu/LiteLLM_Proxy/docker-compose.yml"),
    ("LiteLLM docker-compose file", "cat /home/djelu/LiteLLM_Proxy/docker-compose.yml"),
    ("LiteLLM environment file", "cat /home/djelu/LiteLLM_Proxy/.env | sed 's/AQ[a-zA-Z0-9_-]*/[REDACTED_KEY]/g'"),
    ("LiteLLM container inspection", "docker inspect litellm-gateway --format '{{json .Config.Env}}'")
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
