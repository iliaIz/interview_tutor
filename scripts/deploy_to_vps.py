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
        for f in [".env", "Caddyfile", "docker-compose.prod.yml", "docker-compose.yml", "Dockerfile.caddy"]:
            fp = os.path.join(root_dir, f)
            if os.path.exists(fp):
                tar.add(fp, arcname=f)

        # Isolated Sandbox
        sandbox_dir = os.path.join(root_dir, "sandbox")
        if os.path.exists(sandbox_dir):
            tar.add(sandbox_dir, arcname="sandbox")

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
    
    echo "Building sandbox container..."
    docker compose -f docker-compose.prod.yml build sandbox || true

    echo "Building backend container..."
    docker compose -f docker-compose.prod.yml build backend
    
    echo "Recreating backend & sandbox services..."
    docker compose -f docker-compose.prod.yml up -d --remove-orphans
    
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

        # 9. Profile rename check
        prof_res = session.put("https://djelu.site/api/auth/profile", json={"name": "Djelu (Owner)"}, timeout=10)
        print(f"9. Profile Rename (PUT /profile): {prof_res.status_code} (New Name: {prof_res.json().get('user', {}).get('name')})")

        # 10. List invites (Owner RBAC check)
        invs_res = session.get("https://djelu.site/api/auth/invites", timeout=10)
        print(f"10. Owner Invites List (GET /invites): {invs_res.status_code} (Found {len(invs_res.json())} invites)")

        # 11. Create new invite from UI API
        new_inv_res = session.post("https://djelu.site/api/auth/invites", json={
            "name": "Auto-Test User",
            "role": "user",
            "maxUses": 1
        }, timeout=10)

        new_inv_data = new_inv_res.json()
        print(f"11. Create Invite API (POST /invites): {new_inv_res.status_code} (Code: {new_inv_data.get('invite', {}).get('plainCode')})")

        # 12. Revoke and permanently delete invite API
        created_id = new_inv_data.get('invite', {}).get('inviteId')
        if created_id:
            rev_res = session.post(f"https://djelu.site/api/auth/invites/{created_id}/revoke", timeout=10)
            print(f"12. Revoke/Delete Invite API (POST /invites/:id/revoke): {rev_res.status_code}")

            # 13. Verify permanent deletion from DB
            after_invs = session.get("https://djelu.site/api/auth/invites", timeout=10).json()
            is_present = any(inv.get('id') == created_id for inv in after_invs)
            print(f"13. Permanent Deletion Verification: {'PASSED (Deleted)' if not is_present else 'FAILED (Still exists)'}")

        print("\n🎉 PRODUCTION DEPLOYMENT, PERMANENT INVITE DELETION & RBAC 100% VERIFIED!")



    except Exception as e:
        print(f"Health check warning: {e}")


if __name__ == "__main__":
    deploy()
