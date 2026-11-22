import os
import re
import json

lc_files = [
    ('lc-01-concurrent-hash-map.md', 'lc-alfa-01', 'SegmentedConcurrentHashMap: Сегментная блокировка и volatile-чтение', 'Senior', 40, '⚡ Concurrency', 'Segmented Locking Pattern'),
    ('lc-02-banking-stream-api.md', 'lc-alfa-02', 'BankingStreamProcessor: Агрегация транзакций на Stream API и BigDecimal', 'Middle+', 30, '💳 FinTech', 'Functional Stream Pipeline'),
    ('lc-04-immutable-equals-hashcode.md', 'lc-alfa-04', 'ImmutableAccount & HashCode: Защитное копирование и контракт equals/hashCode', 'Middle', 25, '🏛️ Core Java', 'Defensive Copying & Value Object'),
    ('lc-05-rest-validation-tests.md', 'lc-alfa-05', 'PaymentRestController: Jakarta Bean Validation и Mockito ArgumentCaptor', 'Middle', 35, '🧪 Testing & Spring', 'TDD & Bean Validation'),
]

new_challenges = []
for filename, cid, title, diff, tlimit, badge, arch_pattern in lc_files:
    filepath = os.path.join('tmp/tasks/live-coding', filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # extract starter code
    code_match = re.search(r'```java\n(.*?)```', content, re.DOTALL)
    starter_code = code_match.group(1).strip() if code_match else '// Implementation stub'

    short_desc = f'Практическая лайв-кодинг задача уровня Альфа-Банк ({diff}, {tlimit} мин).'

    package_path = f'src/main/java/com/alfa/interview/{cid.replace("-", "_")}'
    test_path = f'src/test/java/com/alfa/interview/{cid.replace("-", "_")}'

    main_filename = 'Solution.java'
    if cid == 'lc-alfa-01':
        main_filename = 'SegmentedConcurrentHashMap.java'
    elif cid == 'lc-alfa-02':
        main_filename = 'BankingStreamProcessor.java'
    elif cid == 'lc-alfa-04':
        main_filename = 'AccountSnapshot.java'
    elif cid == 'lc-alfa-05':
        main_filename = 'PaymentController.java'

    workspace_files = [
        {
            'path': f'{package_path}/{main_filename}',
            'content': starter_code,
            'isReadOnly': False
        }
    ]

    hints = [
        'Внимательно проверьте инварианты многопоточности и отсутствие гонок.',
        'Для финансовых расчетов используйте строго BigDecimal с RoundingMode.HALF_EVEN.',
        'Обратите внимание на защитное копирование мутабельных коллекций.'
    ]

    ch = {
        'id': cid,
        'slug': cid,
        'title': title,
        'track': 'alfa_livecoding',
        'badge': badge,
        'difficulty': diff,
        'category': 'machine_coding',
        'scenarioMarkdown': content[:300] + '...',
        'shortDescription': short_desc,
        'instructionsMarkdown': content,
        'techStack': 'Java 21 LTS / Concurrency / Spring Boot 3.3',
        'architecturePattern': arch_pattern,
        'timeLimitMinutes': tlimit,
        'workspaceFiles': workspace_files,
        'phases': [
            {
                'phase': 1,
                'unlockTimeMinutes': 0,
                'title': 'Фаза 1: Базовая реализация контракта',
                'descriptionMarkdown': 'Реализуйте базовую логику в соответствии с требованиями карточки.'
            },
            {
                'phase': 2,
                'unlockTimeMinutes': 15,
                'title': 'Фаза 2: Потокобезопасность и краевые случаи',
                'descriptionMarkdown': 'Проверьте граничные условия, гонки и производительность под нагрузкой.'
            }
        ],
        'astRules': ['no-double-in-money'],
        'hints': hints
    }
    new_challenges.append(ch)

with open('json/machine_coding_challenges.json', 'r', encoding='utf-8') as f:
    existing = json.load(f)

updated = [c for c in existing if c['id'] not in {nc['id'] for nc in new_challenges}]
updated.extend(new_challenges)

with open('json/machine_coding_challenges.json', 'w', encoding='utf-8') as f:
    json.dump(updated, f, indent=2, ensure_ascii=False)

print(f'Successfully ingested {len(new_challenges)} Alfa Live Coding challenges! Total in JSON: {len(updated)}')
