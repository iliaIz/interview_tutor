import os
import sys
import paramiko

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_ssh_audit():
    key_path = r"C:\Users\Admin\.ssh\amnezia_rsa"
    passphrase = "DBshirke"
    hostname = "192.124.182.59"
    username = "djelu"

    print(f"Connecting to {username}@{hostname} with SSH key...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    pkey = paramiko.RSAKey.from_private_key_file(key_path, password=passphrase)
    ssh.connect(hostname=hostname, username=username, pkey=pkey, timeout=10)
    print("[SUCCESS] SSH Connection Established!\n")

    commands = [
        ("Uptime & Load Average", "uptime"),
        ("Memory & Swap (free -h)", "free -h"),
        ("Swap Status", "swapon --show"),
        ("Disk Space (df -h /)", "df -h /"),
        ("Running Docker Containers", "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"),
        ("Docker Container Resource Stats", "docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}'"),
        ("Docker Networks", "docker network ls")
    ]

    for title, cmd in commands:
        print(f"=== {title} ({cmd}) ===")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode('utf-8').strip()
        err = stderr.read().decode('utf-8').strip()
        if out:
            print(out)
        if err:
            print(f"[STDERR]: {err}")
        print()

    ssh.close()

if __name__ == "__main__":
    run_ssh_audit()
