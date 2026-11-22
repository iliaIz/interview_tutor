import os
import re
import json

cr_files = [
    ('cr-01-payment-controller.md', 'cr-alfa-01', 'PaymentController: 8+ скрытых дефектов в платёжном REST-контроллере', 'Senior', 20),
    ('cr-02-transaction-retry-loop.md', 'cr-alfa-02', 'CalculationService: Ретраи внутри @Transactional и зависание HikariCP', 'Middle+', 15),
    ('cr-03-db-write-http-post.md', 'cr-alfa-03', 'OrderProcessingService: Нарушение атомарности Dual Write и Transactional Outbox', 'Middle+', 15),
    ('cr-04-string-intern-sync.md', 'cr-alfa-04', 'AccountLocker: Синхронизация на String.intern() и глобальный Deadlock', 'Middle+', 15),
    ('cr-05-hibernate-relationships.md', 'cr-alfa-05', 'CustomerOrderRepository: Hibernate N+1 проблема и антипаттерн EAGER', 'Middle+', 15),
    ('cr-06-try-catch-finally.md', 'cr-alfa-06', 'ExceptionProcessor: Поведение try-catch-finally и перетирание возвращаемых значений', 'Middle', 10),
]

new_katas = []
for filename, kata_id, title, diff, est_min in cr_files:
    filepath = os.path.join('tmp/tasks/code-review', filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # extract first java code block
    code_match = re.search(r'```java\n(.*?)```', content, re.DOTALL)
    code_snippet = code_match.group(1).strip() if code_match else ''

    short_desc = f'Код-ревью реального банковского класса на выявление скрытых дефектов (Альфа-Банк {diff}).'

    workspace_files = [
        {
            'path': f'src/main/java/com/alfa/interview/{kata_id.replace("-", "_")}/VulnerableCode.java',
            'content': code_snippet,
            'isReadOnly': False
        }
    ]

    kata = {
        'id': kata_id,
        'slug': kata_id,
        'title': title,
        'grade': diff,
        'archetype': 'CODE_REVIEW',
        'category': 'refactoring_kata',
        'track': 'alfa_code_review',
        'badge': '🅰️ Alfa Code Review',
        'difficulty': diff,
        'targetStack': 'Java 21 / Spring Boot 3.3',
        'estimatedMinutes': est_min,
        'companyContext': 'АО «Альфа-Банк» (Alfa Digital) — Платформа «А-Токен» и Core Banking',
        'shortDescription': short_desc,
        'instructionsMarkdown': content,
        'workspaceFiles': workspace_files
    }
    new_katas.append(kata)

with open('json/refactoring_challenges.json', 'r', encoding='utf-8') as f:
    existing = json.load(f)

updated = [k for k in existing if k['id'] not in {nk['id'] for nk in new_katas}]
updated.extend(new_katas)

with open('json/refactoring_challenges.json', 'w', encoding='utf-8') as f:
    json.dump(updated, f, indent=2, ensure_ascii=False)

print(f'Successfully ingested {len(new_katas)} Alfa Code Review katas! Total in JSON: {len(updated)}')
