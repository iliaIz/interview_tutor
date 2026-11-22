import glob, os, re

for f in sorted(glob.glob('tmp/tasks/sql-postgresql/*.md')):
    bn = os.path.basename(f)
    print(f'=== {bn} ===')
    with open(f, 'r', encoding='utf-8') as fp:
        lines = fp.readlines()
    for l in lines:
        if l.startswith('#') or 'CREATE TABLE' in l:
            print(' ', l.strip()[:100])
