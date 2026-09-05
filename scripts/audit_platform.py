import json
import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

# 1. Load roadmaps
with open('json/guided_roadmaps.json', 'r', encoding='utf-8') as f:
    raw = json.load(f)
    roadmaps_data = raw.get('roadmaps', []) if isinstance(raw, dict) else raw

print(f"Loaded {len(roadmaps_data)} roadmaps from json/guided_roadmaps.json\n")

# 2. Load all available entities across catalogs
def load_json_list(path, key=None):
    with open(path, 'r', encoding='utf-8') as f:
        d = json.load(f)
        if isinstance(d, list): return d
        if key and key in d: return d[key]
        for k in ['scenarios', 'incidents', 'challenges', 'roadmaps']:
            if k in d: return d[k]
        return []

tx_scenarios = {s['id']: s for s in load_json_list('json/spring_transaction_scenarios.json', 'scenarios')}
sd_scenarios = {s['id']: s for s in load_json_list('json/system_design_scenarios.json', 'scenarios')}
triage_incidents = {s['id']: s for s in load_json_list('json/production_triage_challenges.json', 'incidents')}

# Coding Challenges & Testing Katas from SQLite
conn = sqlite3.connect('backend/data/interview.db')
c = conn.cursor()
c.execute("SELECT id, slug, title, track, difficulty FROM coding_challenges")
coding_rows = c.fetchall()
coding_challenges = {}
for r in coding_rows:
    coding_challenges[r[0]] = {'id': r[0], 'slug': r[1], 'title': r[2], 'track': r[3], 'difficulty': r[4]}
    coding_challenges[r[1]] = {'id': r[0], 'slug': r[1], 'title': r[2], 'track': r[3], 'difficulty': r[4]}

# Questions (Theory)
c.execute("SELECT id, topic, question FROM questions")
q_rows = c.fetchall()
questions_catalog = {r[0]: {'topic': r[1], 'question': r[2]} for r in q_rows}
conn.close()

print(f"Entities in system:")
print(f" - Transactions scenarios: {len(tx_scenarios)}")
print(f" - System Design scenarios: {len(sd_scenarios)}")
print(f" - Incident Triage incidents: {len(triage_incidents)}")
print(f" - Coding Challenges & Testing Katas: {len(coding_challenges)}")
print(f" - Core Questions (Theory): {len(questions_catalog)}")
print("="*60)

# 3. Audit each roadmap for broken links (dead scenarios)
broken_links = []
total_steps = 0
arena_counts = {}

for rm in roadmaps_data:
    rm_id = rm['id']
    steps = rm.get('steps', [])
    total_steps += len(steps)
    step_nums = {s['stepNumber'] for s in steps}
    
    for s in steps:
        arena = s.get('targetArena')
        scenario_id = s.get('targetScenarioId')
        core = s.get('coreRequirements', {})
        arena_counts[arena] = arena_counts.get(arena, 0) + 1
        
        # Check prerequisites
        prereqs = s.get('prerequisiteStepIds', [])
        for p in prereqs:
            # check if prerequisite exists in step numbers
            try:
                p_num = int(p.replace('step_', '')) if 'step_' in str(p) else int(p)
                if p_num not in step_nums:
                    broken_links.append((rm_id, s['stepNumber'], 'prerequisite_missing', p))
            except:
                pass
        
        # Check targetScenarioId existence
        if arena == 'transactions':
            if scenario_id and scenario_id not in tx_scenarios:
                broken_links.append((rm_id, s['stepNumber'], 'missing_tx_scenario', scenario_id))
        elif arena == 'system_design':
            if scenario_id and scenario_id not in sd_scenarios:
                broken_links.append((rm_id, s['stepNumber'], 'missing_sd_scenario', scenario_id))
        elif arena == 'incident_triage':
            if scenario_id and scenario_id not in triage_incidents:
                broken_links.append((rm_id, s['stepNumber'], 'missing_triage_incident', scenario_id))
        elif arena in ('testing_mutation', 'machine_coding'):
            if scenario_id and scenario_id not in coding_challenges:
                broken_links.append((rm_id, s['stepNumber'], 'missing_coding_challenge', scenario_id))

print(f"Total steps audited: {total_steps}")
print(f"Step distribution by arena: {arena_counts}")
print(f"Broken scenario links count: {len(broken_links)}")
for b in broken_links:
    print(f" ⚠️ Broken link in {b[0]} Step #{b[1]}: {b[2]} -> {b[3]}")
