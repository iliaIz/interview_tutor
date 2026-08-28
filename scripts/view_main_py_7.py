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

cmd = "sed -n '841,960p' /home/djelu/LiteLLM_Proxy/gateway/main.py"

_, out, err = ssh.exec_command(cmd)
print("MAIN.PY (841-960):\n", out.read().decode('utf-8'))
ssh.close()
