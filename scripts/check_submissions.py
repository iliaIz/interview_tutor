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

cmd = "docker exec interview-backend-api node -e \"const Database = require('better-sqlite3'); const db = new Database('/app/data/interview.db'); console.log(JSON.stringify(db.prepare('SELECT id, challenge_id, status, score, updated_at FROM coding_submissions').all(), null, 2));\""

_, out, err = ssh.exec_command(cmd)
print("DB SUBMISSIONS:\n", out.read().decode('utf-8'))
ssh.close()
