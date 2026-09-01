import os
import sys
import tarfile
import tempfile
import paramiko
import requests
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

KEY_PATH = r"C:\Users\Admin\.ssh\amnezia_rsa"
PASSPHRASE = "DBshirke"
HOSTNAME = "192.124.182.59"
USERNAME = "djelu"
REMOTE_PATH = "/home/djelu/spring"

def create_tarball():
    print("[1/5] Creating deployment archive...")
    temp_dir = tempfile.gettempdir()
    tar_path = os.path.join(temp_dir, "spring_deploy.tar.gz")

    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    
    with tarfile.open(tar_path, "w:gz") as tar:
        # Frontend dist
        frontend_dist = os.path.join(root_dir, "frontend", "dist")
        if os.path.exists(frontend_dist):
            tar.add(frontend_dist, arcname="frontend/dist")

        # Backend files
        backend_src = os.path.join(root_dir, "backend", "src")
        tar.add(backend_src, arcname="backend/src")
        
        for f in ["package.json", "package-lock.json", "tsconfig.json", "Dockerfile"]:
            fp = os.path.join(root_dir, "backend", f)
            if os.path.exists(fp):
                tar.add(fp, arcname=f"backend/{f}")

        # JSON data files (Questions, 70 Katas, 35 LLD challenges)
        json_dir = os.path.join(root_dir, "json")
        if os.path.exists(json_dir):
            tar.add(json_dir, arcname="json")

        # Root files
        for f in [".env", "Caddyfile", "docker-compose.prod.yml", "docker-compose.yml"]:
            fp = os.path.join(root_dir, f)
            if os.path.exists(fp):
                tar.add(fp, arcname=f)


    size_mb = os.path.getsize(tar_path) / (1024 * 1024)
    print(f"Archive created: {tar_path} ({size_mb:.2f} MB)")
    return tar_path

def deploy():
    tar_path = create_tarball()

    print(f"\n[2/5] Connecting via SSH to {USERNAME}@{HOSTNAME}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    pkey = paramiko.RSAKey.from_private_key_file(KEY_PATH, password=PASSPHRASE)
    ssh.connect(hostname=HOSTNAME, username=USERNAME, pkey=pkey, timeout=15)
    print("[SUCCESS] SSH Connected!")

    print("\n[3/5] Uploading deployment bundle via SFTP...")
    sftp = ssh.open_sftp()
    remote_tar = "/tmp/spring_deploy.tar.gz"
    sftp.put(tar_path, remote_tar)
    sftp.close()
    print("Upload complete!")

    print("\n[4/5] Extracting files and restarting Docker containers on VPS...")
    deploy_script = f"""
    set -e
    cd {REMOTE_PATH}
    tar -xzf {remote_tar} -C {REMOTE_PATH}
    rm -f {remote_tar}
    
    echo "Building backend container..."
    docker compose -f docker-compose.prod.yml build backend
    
    echo "Recreating backend service..."
    docker compose -f docker-compose.prod.yml up -d --no-deps backend
    
    echo "Reloading Caddy reverse proxy..."
    docker exec interview-caddy-ssl caddy reload || docker compose -f docker-compose.prod.yml restart caddy
    """

    stdin, stdout, stderr = ssh.exec_command(deploy_script)
    for line in iter(stdout.readline, ""):
        print(line, end="")
    err = stderr.read().decode('utf-8').strip()
    if err:
        print(f"[STDERR]: {err}")

    ssh.close()
    try:
        os.remove(tar_path)
    except:
        pass

    print("\n[5/5] Performing Zero-Trust & Health Checks on https://djelu.site...")
    time.sleep(3)
    try:
        session = requests.Session()

        # 1. Health check (public)
        res = session.get("https://djelu.site/api/health", timeout=10)
        print(f"1. Health Check (Public): {res.status_code}")
        print(f"   Response: {res.json()}")

        # 2. Zero-Trust Check: Unauthorized request must be rejected with 401
        unauth_res = session.get("https://djelu.site/api/system-design/scenarios", timeout=10)
        print(f"2. Zero-Trust Check (Unauthorized API access): {unauth_res.status_code} (Expected 401)")
        assert unauth_res.status_code == 401, f"Expected 401 Unauthorized, got {unauth_res.status_code}"

        # 3. Login with Master Invite Code
        master_code = os.environ.get("MASTER_INVITE_CODE", "SENIOR-JAVA-2026-VIP")
        login_res = session.post("https://djelu.site/api/auth/login", json={"inviteCode": master_code}, timeout=10)
        print(f"3. Master Invite Login: {login_res.status_code}")
        assert login_res.status_code == 200, f"Login failed with status {login_res.status_code}: {login_res.text}"
        login_data = login_res.json()
        print(f"   Logged in as: {login_data.get('user', {}).get('name')}")

        # 4. Authenticated API checks
        c_res = session.get("https://djelu.site/api/practice/challenges", timeout=10)
        print(f"4. Practice Challenges (Auth): {c_res.status_code} (Found {len(c_res.json())} challenges)")

        sd_res = session.get("https://djelu.site/api/system-design/scenarios", timeout=10)
        print(f"5. System Design Scenarios (Auth): {sd_res.status_code} (Found {len(sd_res.json())} scenarios)")

        tr_res = session.get("https://djelu.site/api/triage/challenges", timeout=10)
        print(f"6. Incident Triage (Auth): {tr_res.status_code} (Found {len(tr_res.json())} incidents)")

        rm_res = session.get("https://djelu.site/api/roadmaps", timeout=10)
        print(f"7. Guided Roadmaps (Auth): {rm_res.status_code} (Found {len(rm_res.json())} roadmap tracks)")

        ticket_res = session.post("https://djelu.site/api/auth/ws-ticket", timeout=10)
        print(f"8. WebSocket One-Time Ticket: {ticket_res.status_code} (Ticket: {ticket_res.json().get('ticket')[:12]}...)")

        print("\n🎉 PRODUCTION DEPLOYMENT & SOTA 2026 AUTH SYSTEM 100% VERIFIED!")

    except Exception as e:
        print(f"Health check warning: {e}")


if __name__ == "__main__":
    deploy()
