import sys
import paramiko

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
pkey = paramiko.RSAKey.from_private_key_file(r'C:\Users\Admin\.ssh\amnezia_rsa', password='DBshirke')
ssh.connect(hostname='192.124.182.59', username='djelu', pkey=pkey, timeout=10)

cmds = [
    ("Check caddy", "docker ps | grep caddy || ps aux | grep caddy"),
    ("Find Caddyfile", "find / -name Caddyfile 2>/dev/null")
]

for title, cmd in cmds:
    print(f"=== {title} ===")
    _, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    if out:
        print(out)
    if err:
        print(f"[ERR]: {err}")
    print()

ssh.close()
