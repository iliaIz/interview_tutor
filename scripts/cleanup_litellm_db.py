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

sftp = ssh.open_sftp()
with sftp.file('/tmp/dedup.sql', 'w') as f:
    f.write("""
DELETE FROM "LiteLLM_ProxyModelTable" WHERE model_id NOT IN (
  SELECT DISTINCT ON (model_name) model_id
  FROM "LiteLLM_ProxyModelTable"
  ORDER BY model_name, created_at DESC
);
SELECT count(*) as total_clean_models FROM "LiteLLM_ProxyModelTable";
SELECT model_name, count(*) as count FROM "LiteLLM_ProxyModelTable" GROUP BY model_name ORDER BY model_name;
""")
sftp.close()

cmd = "docker exec -i litellm-postgres-db psql -U litellm_user -d litellm_db < /tmp/dedup.sql"

_, out, err = ssh.exec_command(cmd)
print("OUT:\n", out.read().decode('utf-8'))
print("ERR:\n", err.read().decode('utf-8'))
ssh.close()
