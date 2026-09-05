import json
import os
import re

JSON_DIR = os.path.join(os.path.dirname(__file__), '..', 'json')
ROADMAPS_FILE = os.path.join(JSON_DIR, 'guided_roadmaps.json')

with open(ROADMAPS_FILE, 'r', encoding='utf-8') as f:
    roadmaps = json.load(f)

print(f"Loaded {len(roadmaps)} roadmaps from {ROADMAPS_FILE}")

rm_map = {r['id']: r for r in roadmaps}

staff_rm = rm_map.get('staff-principal-track-60')
if staff_rm:
    for i, step in enumerate(staff_rm['steps']):
        step_num = step.get('stepNumber', i + 1)
        step['requiredForGrade'] = 'L6'
        step['prerequisiteStepIds'] = [f"staff_step_{i}"] if i > 0 else []
        title = step['title'].lower()

        if any(w in title for w in ['dump', 'triage', 'forensic', 'leak', 'safepoint', 'g1gc', 'zgc', 'cgroups', 'throttle', 'pinning']):
            step['targetArena'] = 'incident_triage'
            step['domain'] = 'incident_triage'
            if 'netty' in title or 'direct' in title:
                step['targetScenarioId'] = 'triage-incident-10'
            elif 'pinning' in title:
                step['targetScenarioId'] = 'triage-incident-02'
            elif 'g1gc' in title or 'humongous' in title:
                step['targetScenarioId'] = 'triage-incident-11'
            elif 'zgc' in title:
                step['targetScenarioId'] = 'triage-incident-12'
            elif 'safepoint' in title:
                step['targetScenarioId'] = 'triage-incident-13'
            elif 'rebalance' in title or 'kafka' in title:
                step['targetScenarioId'] = 'triage-incident-06'
            elif 'deadlock' in title:
                step['targetScenarioId'] = 'triage-incident-01'
            elif 'cgroups' in title or 'k8s' in title:
                step['targetScenarioId'] = 'triage-l1-03'
            else:
                step['targetScenarioId'] = f"triage-incident-{((i % 15) + 1):02d}"

        elif any(w in title for w in ['transaction', 'acid', 'mvcc', 'isolation', 'outbox', 'saga', '2pc', 'hikaricp']):
            step['targetArena'] = 'transactions'
            step['domain'] = 'transactions'
            if 'outbox' in title or 'skew' in title:
                step['targetScenarioId'] = 'write_skew_and_outbox'
            elif 'saga' in title:
                step['targetScenarioId'] = 'distributed_saga_compensating_actions'
            elif 'pool' in title or 'hikari' in title:
                step['targetScenarioId'] = 'hikaricp_pool_deadlock'
            elif 'savepoint' in title:
                step['targetScenarioId'] = 'nested_savepoints_partial_rollback'
            else:
                step['targetScenarioId'] = 'propagation_required_vs_requires_new'

        elif any(w in title for w in ['test', 'mutation', 'archunit', 'seam', 'verification', 'audit']):
            step['targetArena'] = 'testing_mutation'
            step['domain'] = 'testing'
            if 'archunit' in title:
                step['targetScenarioId'] = 'kata_test_strict_in_order_audit'
            elif 'order' in title:
                step['targetScenarioId'] = 'kata_test_order_state_machine_dynamic'
            else:
                step['targetScenarioId'] = 'kata_test_idempotent_account_service'

        elif any(w in title for w in ['design', 'raft', 'consensus', 'sharding', 'event-driven', 'cache', 'cdn', 'scale', 'highload', 'ledger', 'rate limiter']):
            step['targetArena'] = 'system_design'
            step['domain'] = 'system_design'
            scen_num = (i % 20) + 1
            step['targetScenarioId'] = f"hld-scenario-{scen_num:02d}"

        else:
            step['targetArena'] = 'machine_coding'
            step['domain'] = 'concurrency'
            step['targetScenarioId'] = 'rate-limiter-token-bucket'

        step['pedagogicalRationale'] = f"Staff/Principal Bar-Raiser шаг #{step_num}: глубокий анализ системных инвариантов и компромиссов в {step['targetArena']}."
        if 'coreRequirements' in step:
            step['coreRequirements']['targetArena'] = step['targetArena']
            step['coreRequirements']['targetScenarioId'] = step['targetScenarioId']

with open(ROADMAPS_FILE, 'w', encoding='utf-8') as f:
    json.dump(roadmaps, f, ensure_ascii=False, indent=2)

print("Refined staff-principal-track-60 arenas successfully")
