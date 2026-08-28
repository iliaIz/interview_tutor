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
with sftp.file('/home/djelu/LiteLLM_Proxy/gateway/main.py', 'r') as f:
    code = f.read().decode('utf-8')

old_code = '''async def sync_cascades_to_litellm():
    """Sync all active model cascades into LiteLLM PostgreSQL tables."""
    if not db_pool:
        return
    try:
        async with db_pool.acquire() as conn:
            prefix_row = await conn.fetchrow("SELECT value FROM gateway_settings WHERE key = 'model_prefix'")
            prefix = prefix_row["value"] if prefix_row else "gemini"
            cascades = await conn.fetch("SELECT * FROM gateway_model_cascades WHERE active = TRUE")
            base_models = await conn.fetch("SELECT * FROM gateway_base_models WHERE active = TRUE")
            provider_keys = await conn.fetch("SELECT * FROM gateway_provider_keys WHERE active = TRUE ORDER BY priority ASC, created_at ASC")

        bm_map = {row["name"]: row["target"] for row in base_models}
        active_key = provider_keys[0]["raw_key"] if provider_keys else ""

        for casc in cascades:
            alias = casc["alias"]
            full_alias = f"{prefix}-{alias}" if prefix else alias
            cascade_items = json.loads(casc["cascade"]) if isinstance(casc["cascade"], str) else casc["cascade"]
            
            for item in cascade_items:
                if not item.get("active", True):
                    continue
                m_name = item.get("modelName")
                if m_name in bm_map:
                    target_model = bm_map[m_name]
                    target_model = target_model if target_model.startswith("gemini/") else f"gemini/{target_model}"
                    
                    try:
                        await http_client.post(
                            f"{LITELLM_BACKEND_URL}/model/new",
                            headers={
                                "Authorization": f"Bearer {LITELLM_MASTER_KEY}",
                                "Content-Type": "application/json"
                            },
                            json={
                                "model_name": full_alias,
                                "litellm_params": {
                                    "model": target_model,
                                    "api_key": active_key or None
                                }
                            },
                            timeout=5.0
                        )
                    except Exception as e:
                        logger.debug(f"LiteLLM model sync note: {e}")
        logger.info("✅ Cascades and models synced to LiteLLM core daemon")'''

new_code = '''async def sync_cascades_to_litellm():
    """Sync all active model cascades into LiteLLM PostgreSQL tables (Idempotent SOTA 2026)."""
    if not db_pool:
        return
    try:
        async with db_pool.acquire() as conn:
            prefix_row = await conn.fetchrow("SELECT value FROM gateway_settings WHERE key = 'model_prefix'")
            prefix = prefix_row["value"] if prefix_row else "gemini"
            cascades = await conn.fetch("SELECT * FROM gateway_model_cascades WHERE active = TRUE")
            base_models = await conn.fetch("SELECT * FROM gateway_base_models WHERE active = TRUE")
            provider_keys = await conn.fetch("SELECT * FROM gateway_provider_keys WHERE active = TRUE ORDER BY priority ASC, created_at ASC")
            
            # Idempotency check: fetch registered model names
            existing_rows = await conn.fetch('SELECT DISTINCT model_name FROM "LiteLLM_ProxyModelTable"')
            registered_model_names = set(r["model_name"] for r in existing_rows)

        bm_map = {row["name"]: row["target"] for row in base_models}
        active_key = provider_keys[0]["raw_key"] if provider_keys else ""

        for casc in cascades:
            alias = casc["alias"]
            full_alias = f"{prefix}-{alias}" if prefix else alias
            
            # If model already registered in LiteLLM, avoid creating duplicate entries
            if full_alias in registered_model_names:
                continue

            cascade_items = json.loads(casc["cascade"]) if isinstance(casc["cascade"], str) else casc["cascade"]
            
            for item in cascade_items:
                if not item.get("active", True):
                    continue
                m_name = item.get("modelName")
                if m_name in bm_map:
                    target_model = bm_map[m_name]
                    target_model = target_model if target_model.startswith("gemini/") else f"gemini/{target_model}"
                    
                    try:
                        await http_client.post(
                            f"{LITELLM_BACKEND_URL}/model/new",
                            headers={
                                "Authorization": f"Bearer {LITELLM_MASTER_KEY}",
                                "Content-Type": "application/json"
                            },
                            json={
                                "model_name": full_alias,
                                "litellm_params": {
                                    "model": target_model,
                                    "api_key": active_key or None
                                }
                            },
                            timeout=5.0
                        )
                        registered_model_names.add(full_alias)
                        break
                    except Exception as e:
                        logger.debug(f"LiteLLM model sync note: {e}")
        logger.info("✅ Cascades and models idempotently verified with LiteLLM core daemon")'''

if old_code in code:
    code = code.replace(old_code, new_code)
    with sftp.file('/home/djelu/LiteLLM_Proxy/gateway/main.py', 'w') as f:
        f.write(code.encode('utf-8'))
    print("SUCCESS: main.py patched with idempotent model registration!")
else:
    print("WARNING: exact block not found for replacement, checking if already patched.")
    if "Idempotent SOTA 2026" in code:
        print("Already patched!")

sftp.close()
ssh.close()
