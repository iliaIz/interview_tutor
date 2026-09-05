import json
import os

JSON_DIR = os.path.join(os.path.dirname(__file__), '..', 'json')
ROADMAPS_FILE = os.path.join(JSON_DIR, 'guided_roadmaps.json')

with open(ROADMAPS_FILE, 'r', encoding='utf-8') as f:
    roadmaps = json.load(f)

print(f"Loaded {len(roadmaps)} roadmaps from {ROADMAPS_FILE}")

# Map of existing roadmaps by ID
rm_map = {r['id']: r for r in roadmaps}

# 1. Update spring3-transactions-master-15
tx_rm = rm_map.get('spring3-transactions-master-15')
if tx_rm:
    tx_scenario_ids = [
        'self_invocation_bypass',
        'checked_exception_rollback',
        'propagation_required_vs_requires_new',
        'readonly_dirty_checking',
        'after_commit_listener_silent_loss',
        'private_method_transactional_noop',
        'unexpected_rollback_exception_trap',
        'external_io_idle_in_tx',
        'non_repeatable_read_vs_repeatable',
        'aop_order_retry_collision',
        'distributed_saga_compensating_actions',
        'isolation_leak_pool',
        'hikaricp_pool_deadlock',
        'async_threadlocal_context_loss',
        'write_skew_and_outbox'
    ]
    for i, step in enumerate(tx_rm['steps']):
        scen_id = tx_scenario_ids[i] if i < len(tx_scenario_ids) else 'self_invocation_bypass'
        step['targetArena'] = 'transactions'
        step['targetScenarioId'] = scen_id
        step['domain'] = 'transactions'
        step['requiredForGrade'] = 'L5'
        step['prerequisiteStepIds'] = [f"tx_step_{i}"] if i > 0 else []
        step['pedagogicalRationale'] = f"Интерактивная отработка ловушки транзакций '{step['title']}' в Spring Transactions Lab с AST-валидацией и симуляцией пула HikariCP."
        if 'coreRequirements' in step:
            step['coreRequirements']['taskType'] = 'transactions'
            step['coreRequirements']['targetArena'] = 'transactions'
            step['coreRequirements']['targetScenarioId'] = scen_id

# 2. Update highload-system-design-15
sd_rm = rm_map.get('highload-system-design-15')
if sd_rm:
    sd_scenario_ids = [
        'hld-micro-01',
        'hld-micro-02',
        'hld-micro-03',
        'hld-micro-04',
        'hld-micro-05',
        'hld-micro-06',
        'hld-micro-07',
        'hld-micro-08',
        'hld-faded-01',
        'hld-faded-02',
        'hld-scenario-01',
        'hld-scenario-02',
        'hld-scenario-05',
        'hld-scenario-09',
        'hld-scenario-13'
    ]
    for i, step in enumerate(sd_rm['steps']):
        scen_id = sd_scenario_ids[i] if i < len(sd_scenario_ids) else 'hld-scenario-01'
        step['targetArena'] = 'system_design'
        step['targetScenarioId'] = scen_id
        step['domain'] = 'system_design'
        step['requiredForGrade'] = 'L5'
        step['prerequisiteStepIds'] = [f"sd_step_{i}"] if i > 0 else []
        step['pedagogicalRationale'] = f"Архитектурное проектирование и анализ компромиссов для '{step['title']}' на интерактивном холсте System Design Arena."
        if 'coreRequirements' in step:
            step['coreRequirements']['taskType'] = 'hld'
            step['coreRequirements']['targetArena'] = 'system_design'
            step['coreRequirements']['targetScenarioId'] = scen_id
            step['coreRequirements']['hldScenarioId'] = scen_id

# 3. Update jvm-forensics-triage-12
triage_rm = rm_map.get('jvm-forensics-triage-12')
if triage_rm:
    triage_incident_ids = [
        'triage-l0-01',
        'triage-l0-02',
        'triage-l0-03',
        'triage-l0-04',
        'triage-l1-01',
        'triage-l1-02',
        'triage-l1-03',
        'triage-incident-01',
        'triage-incident-02',
        'triage-incident-04',
        'triage-incident-07',
        'triage-incident-11'
    ]
    for i, step in enumerate(triage_rm['steps']):
        inc_id = triage_incident_ids[i] if i < len(triage_incident_ids) else 'triage-incident-01'
        step['targetArena'] = 'incident_triage'
        step['targetScenarioId'] = inc_id
        step['domain'] = 'incident_triage'
        step['requiredForGrade'] = 'L5'
        step['prerequisiteStepIds'] = [f"triage_step_{i}"] if i > 0 else []
        step['pedagogicalRationale'] = f"Расследование аварии '{step['title']}' в Incident Triage Studio: анализ дампов памяти, тредов и метрик с подсказками Incident Commander."
        if 'coreRequirements' in step:
            step['coreRequirements']['taskType'] = 'triage'
            step['coreRequirements']['targetArena'] = 'incident_triage'
            step['coreRequirements']['targetScenarioId'] = inc_id
            step['coreRequirements']['triageIncidentId'] = inc_id

# 4. Update java21-concurrency-master-15
conc_rm = rm_map.get('java21-concurrency-master-15')
if conc_rm:
    for i, step in enumerate(conc_rm['steps']):
        step['domain'] = 'concurrency'
        step['requiredForGrade'] = 'L5'
        step['prerequisiteStepIds'] = [f"conc_step_{i}"] if i > 0 else []
        # Assign targets
        if i in [1, 5, 8]:
            step['targetArena'] = 'incident_triage'
            step['targetScenarioId'] = 'triage-incident-02' if i == 1 else ('triage-l0-01' if i == 5 else 'triage-incident-01')
        elif i in [2, 6, 11]:
            step['targetArena'] = 'testing_mutation'
            step['targetScenarioId'] = 'kata_test_strict_in_order_audit' if i == 2 else ('kata_test_idempotent_account_service' if i == 6 else 'kata_test_resilience_circuit_breaker')
        else:
            step['targetArena'] = 'machine_coding'
            step['targetScenarioId'] = step.get('coreRequirements', {}).get('lldChallengeSlug') or 'rate-limiter-token-bucket'
        step['pedagogicalRationale'] = f"Углубленное освоение конкурентности в Java 21: '{step['title']}' через практическую арену {step['targetArena']}."
        if 'coreRequirements' in step:
            step['coreRequirements']['targetArena'] = step['targetArena']
            step['coreRequirements']['targetScenarioId'] = step['targetScenarioId']

# 5. Update senior-bigtech-sprint-25
senior_rm = rm_map.get('senior-bigtech-sprint-25')
if senior_rm:
    for i, step in enumerate(senior_rm['steps']):
        step_num = step.get('stepNumber', i + 1)
        step['requiredForGrade'] = 'L5'
        step['prerequisiteStepIds'] = [f"senior_step_{i}"] if i > 0 else []
        core = step.get('coreRequirements', {})

        # Distribute across arenas based on milestone and topic
        if core.get('triageIncidentId'):
            step['targetArena'] = 'incident_triage'
            step['targetScenarioId'] = core['triageIncidentId']
            step['domain'] = 'incident_triage'
        elif core.get('hldScenarioId'):
            step['targetArena'] = 'system_design'
            step['targetScenarioId'] = core['hldScenarioId']
            step['domain'] = 'system_design'
        elif step_num in [6, 7, 8, 9, 10]:
            step['targetArena'] = 'transactions'
            tx_map_senior = {
                6: 'self_invocation_bypass',
                7: 'propagation_required_vs_requires_new',
                8: 'readonly_dirty_checking',
                9: 'external_io_idle_in_tx',
                10: 'hikaricp_pool_deadlock'
            }
            step['targetScenarioId'] = tx_map_senior.get(step_num, 'self_invocation_bypass')
            step['domain'] = 'transactions'
        elif step_num in [11, 12, 13]:
            step['targetArena'] = 'testing_mutation'
            test_map_senior = {
                11: 'kata_test_financial_tx_validator',
                12: 'kata_test_trip_service_seam',
                13: 'kata_test_strict_in_order_audit'
            }
            step['targetScenarioId'] = test_map_senior.get(step_num, 'kata_test_financial_tx_validator')
            step['domain'] = 'testing'
        elif core.get('lldChallengeSlug'):
            step['targetArena'] = 'machine_coding'
            step['targetScenarioId'] = core['lldChallengeSlug']
            step['domain'] = 'concurrency' if step_num <= 5 else 'core_java'
        else:
            step['targetArena'] = 'theory'
            step['targetScenarioId'] = 'core'
            step['domain'] = 'core_java'

        step['pedagogicalRationale'] = f"Ключевой шаг L5 BigTech Sprint: '{step['title']}' с фокусом на практическую отработку в целевой арене {step['targetArena']}."
        if 'coreRequirements' in step:
            step['coreRequirements']['targetArena'] = step['targetArena']
            step['coreRequirements']['targetScenarioId'] = step['targetScenarioId']

# 6. Update staff-principal-track-60
staff_rm = rm_map.get('staff-principal-track-60')
if staff_rm:
    for i, step in enumerate(staff_rm['steps']):
        step_num = step.get('stepNumber', i + 1)
        step['requiredForGrade'] = 'L6'
        step['prerequisiteStepIds'] = [f"staff_step_{i}"] if i > 0 else []
        core = step.get('coreRequirements', {})

        if core.get('hldScenarioId'):
            step['targetArena'] = 'system_design'
            step['targetScenarioId'] = core['hldScenarioId']
            step['domain'] = 'system_design'
        elif core.get('triageIncidentId'):
            step['targetArena'] = 'incident_triage'
            step['targetScenarioId'] = core['triageIncidentId']
            step['domain'] = 'incident_triage'
        elif i % 5 == 0:
            step['targetArena'] = 'transactions'
            step['targetScenarioId'] = 'write_skew_and_outbox'
            step['domain'] = 'transactions'
        elif i % 5 == 1:
            step['targetArena'] = 'testing_mutation'
            step['targetScenarioId'] = 'kata_test_idempotent_account_service'
            step['domain'] = 'testing'
        else:
            step['targetArena'] = 'machine_coding'
            step['targetScenarioId'] = core.get('lldChallengeSlug') or 'rate-limiter-token-bucket'
            step['domain'] = 'concurrency'

        step['pedagogicalRationale'] = f"Staff/Principal Bar-Raiser шаг #{step_num}: глубокий анализ системных инвариантов и компромиссов в {step['targetArena']}."
        if 'coreRequirements' in step:
            step['coreRequirements']['targetArena'] = step['targetArena']
            step['coreRequirements']['targetScenarioId'] = step['targetScenarioId']

# 7. Create middle-java-spring-20 (🌱 Track: Middle Java/Spring Acceleration)
middle_track = {
    "id": "middle-java-spring-20",
    "category": "career",
    "title": "🌱 Middle Java/Spring Acceleration (20 Шагов)",
    "badge": "Junior → Middle Прорыв",
    "totalSteps": 20,
    "difficulty": "solid_senior",
    "estimatedDuration": "3 недели (базовый темп)",
    "description": "Сквозная программа ускоренного перехода от Junior к уверенному Middle: ликвидация пробелов в JUnit 5, Spring Transactions, примитивах конкурентности и базовом системном дизайне.",
    "milestones": [
        {
            "id": "mid_m1",
            "title": "Майлстоун 1: Java Core, Исключения & JUnit 5",
            "stepRange": "1–5"
        },
        {
            "id": "mid_m2",
            "title": "Майлстоун 2: Spring Boot 3 IoC, AOP & Границы транзакций",
            "stepRange": "6–10"
        },
        {
            "id": "mid_m3",
            "title": "Майлстоун 3: Concurrency Primitives & Триаж Проблем",
            "stepRange": "11–15"
        },
        {
            "id": "mid_m4",
            "title": "Майлстоун 4: Микро-архитектура & System Design Basics",
            "stepRange": "16–20"
        }
    ],
    "steps": [
        {
            "stepNumber": 1,
            "title": "Параметризованные тесты и граничные условия в JUnit 5",
            "milestoneId": "mid_m1",
            "seniorBarConcept": "@ParameterizedTest, @ValueSource, @CsvSource, тестирование граничных значений.",
            "interviewTrap": "Написание множества дублирующих @Test методов вместо одного компактного параметризованного сьюта.",
            "estimatedMinutes": 15,
            "targetArena": "testing_mutation",
            "targetScenarioId": "kata_test_financial_tx_validator",
            "domain": "testing",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": [],
            "pedagogicalRationale": "Освоение параметризации в JUnit 5 — ключевой маркер качественного кода при переходе на грейд Middle.",
            "coreRequirements": {
                "theoryTopic": "core",
                "theoryTitle": "Как аннотация @ParameterizedTest сокращает время выполнения и дублирование тестового кода?",
                "taskType": "testing_mutation",
                "targetArena": "testing_mutation",
                "targetScenarioId": "kata_test_financial_tx_validator",
                "taskDescription": "Покрыть предикатную валидацию транзакций параметризованными проверками граничных сумм."
            },
            "bonusDeepDive": {
                "title": "⭐ Custom ArgumentProvider",
                "description": "Реализация интерфейса ArgumentsProvider для генерации сложных доменных объектов."
            },
            "masteryChecklist": [
                "Уверенное использование @ParameterizedTest и @CsvSource",
                "Успешное прохождение валидатора финансовых транзакций",
                "Проверка экстремальных граничных условий (0, отрицательные числа, MAX_VALUE)"
            ],
            "crossCourseLinks": ["testing-mutation-master-15:step-1"]
        },
        {
            "stepNumber": 2,
            "title": "Checked Exceptions и откат транзакций в Spring",
            "milestoneId": "mid_m1",
            "seniorBarConcept": "Поведение Spring TransactionManager по умолчанию: rollbackFor = RuntimeException.",
            "interviewTrap": "Уверенность в том, что выброс любого Exception автоматически откатывает транзакцию в БД.",
            "estimatedMinutes": 15,
            "targetArena": "transactions",
            "targetScenarioId": "checked_exception_rollback",
            "domain": "transactions",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["mid_step_1"],
            "pedagogicalRationale": "Одна из самых частых причин утечек данных в проде — непонимание правил отката Checked Exceptions.",
            "coreRequirements": {
                "theoryTopic": "spring",
                "theoryTitle": "Почему Spring по умолчанию не откатывает транзакции при возникновении проверяемых исключений?",
                "taskType": "transactions",
                "targetArena": "transactions",
                "targetScenarioId": "checked_exception_rollback",
                "taskDescription": "Сконфигурировать rollbackFor в сценарии L0_03_checked_exception_rollback для сохранения консистентности."
            },
            "bonusDeepDive": {
                "title": "⭐ noRollbackFor Anti-patterns",
                "description": "Анализ рисков применения noRollbackFor при логировании ошибок в БД."
            },
            "masteryChecklist": [
                "Понимание разницы между RuntimeException и Checked Exception в контексте AOP-прокси",
                "Успешное предотвращение некорректного коммита в Spring Transactions Lab"
            ],
            "crossCourseLinks": ["spring3-transactions-master-15:step-2"]
        },
        {
            "stepNumber": 3,
            "title": "Тестирование легаси-кода через Seams (Швы)",
            "milestoneId": "mid_m1",
            "seniorBarConcept": "Техника Subclass & Override Seam (Майкл Физерс) для изоляции глобального состояния.",
            "interviewTrap": "Попытка переписать весь легаси-класс ради добавления простого теста, ломающая существующую бизнес-логику.",
            "estimatedMinutes": 20,
            "targetArena": "testing_mutation",
            "targetScenarioId": "kata_test_trip_service_seam",
            "domain": "testing",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["mid_step_2"],
            "pedagogicalRationale": "В реальных проектах 80% времени уходит на сопровождение существующего кода, где швы — единственный безопасный способ тестирования.",
            "coreRequirements": {
                "theoryTopic": "core",
                "theoryTitle": "Что такое 'шов' (Seam) и точка включения (Enabling Point) в терминологии Working Effectively with Legacy Code?",
                "taskType": "testing_mutation",
                "targetArena": "testing_mutation",
                "targetScenarioId": "kata_test_trip_service_seam",
                "taskDescription": "Разорвать связь с синглтоном UserSession через переопределение protected-метода."
            },
            "bonusDeepDive": {
                "title": "⭐ Extract Interface vs Seam",
                "description": "Сравнение затрат на рефакторинг при выделении интерфейса против наследования со швом."
            },
            "masteryChecklist": [
                "Выделение шва без изменения внешнего публичного контракта",
                "100% изоляция от статического синглтона в TripService"
            ],
            "crossCourseLinks": ["testing-mutation-master-15:step-2"]
        },
        {
            "stepNumber": 4,
            "title": "Контракты equals(), hashCode() и внутренности HashMap",
            "milestoneId": "mid_m1",
            "seniorBarConcept": "Хеш-коллизии, бакетизация, трансформация бакетов в красно-черные деревья (TREEIFY_THRESHOLD = 8).",
            "interviewTrap": "Нарушение симметричности или транзитивности в equals() при наследовании классов.",
            "estimatedMinutes": 20,
            "targetArena": "theory",
            "targetScenarioId": "core",
            "domain": "core_java",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["mid_step_3"],
            "pedagogicalRationale": "Фундаментальный вопрос любого технического скрининга: знание внутреннего устройства структур данных.",
            "coreRequirements": {
                "theoryTopic": "core",
                "theoryTitle": "Что произойдет при изменении мутабельного поля объекта, уже помещенного в HashMap в качестве ключа?",
                "taskType": "theory",
                "targetArena": "theory",
                "targetScenarioId": "core",
                "taskDescription": "Изучить раздел HashMap в Базе Знаний и сдать проверочный блиц."
            },
            "bonusDeepDive": {
                "title": "⭐ Records & IdentityHashCode",
                "description": "Автоматическая кодогенерация equals/hashCode в Java Record и особенности System.identityHashCode."
            },
            "masteryChecklist": [
                "Понимание работы хеш-таблицы и алгоритма разрешения коллизий",
                "Соблюдение инварианта: if a.equals(b) -> a.hashCode() == b.hashCode()"
            ],
            "crossCourseLinks": []
        },
        {
            "stepNumber": 5,
            "title": "Approval Testing & Golden Master (Gilded Rose)",
            "milestoneId": "mid_m1",
            "seniorBarConcept": "Снятие эталонного снимка поведения (Golden Master) для безопасного рефакторинга клубка условных операторов.",
            "interviewTrap": "Попытка юнит-тестировать отдельные ветки запутанных if-else вместо фиксации вывода на комбинаторном входе.",
            "estimatedMinutes": 25,
            "targetArena": "testing_mutation",
            "targetScenarioId": "kata_test_gilded_rose_approval",
            "domain": "testing",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["mid_step_4"],
            "pedagogicalRationale": "Golden Master — золотой стандарт работы с легаси при подготовке к промышленной разработке.",
            "coreRequirements": {
                "theoryTopic": "core",
                "theoryTitle": "В каких случаях Approval Testing предпочтительнее классических ассертов assertEquals?",
                "taskType": "testing_mutation",
                "targetArena": "testing_mutation",
                "targetScenarioId": "kata_test_gilded_rose_approval",
                "taskDescription": "Сформировать тестовую матрицу для Gilded Rose и зафиксировать эталонное поведение."
            },
            "bonusDeepDive": {
                "title": "⭐ PITest Mutation Testing",
                "description": "Запуск анализатора мутаций для верификации живучести эталонного снимка."
            },
            "masteryChecklist": [
                "Покрытие всех 5 типов товаров и краевых дней срока годности",
                "Успешный прогон Approval-теста"
            ],
            "crossCourseLinks": ["testing-mutation-master-15:step-3"]
        },
        {
            "stepNumber": 6,
            "title": "Self-Invocation Bypass CGLIB-прокси в Spring Boot",
            "milestoneId": "mid_m2",
            "seniorBarConcept": "Вызов метода с аннотацией @Transactional через 'this' минует Dynamic Proxy / CGLIB перехватчик.",
            "interviewTrap": "Уверенность в том, что Spring перехватывает приватные или внутренние вызовы бина без сторонних механизмов.",
            "estimatedMinutes": 15,
            "targetArena": "transactions",
            "targetScenarioId": "self_invocation_bypass",
            "domain": "transactions",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["mid_step_5"],
            "pedagogicalRationale": "Классический вопрос на каждом Spring-интервью. В Transactions Lab наглядно виден обход прокси.",
            "coreRequirements": {
                "theoryTopic": "spring",
                "theoryTitle": "Почему вызов метода внутри того же бина не оборачивается в транзакцию при использовании Spring AOP?",
                "taskType": "transactions",
                "targetArena": "transactions",
                "targetScenarioId": "self_invocation_bypass",
                "taskDescription": "Устранить обход прокси через перенос метода в отдельный сервис или внедрение ApplicationContext."
            },
            "bonusDeepDive": {
                "title": "⭐ AspectJ Compile-Time Weaving",
                "description": "Сравнение Spring CGLIB Proxy и честного AspectJ Weaving при локальных вызовах."
            },
            "masteryChecklist": [
                "Четкое понимание устройства прокси-обертки Spring",
                "Успешное исправление сценария L0_02 в Transactions Lab"
            ],
            "crossCourseLinks": ["spring3-transactions-master-15:step-1"]
        },
        {
            "stepNumber": 7,
            "title": "readOnly = true и отключение Dirty Checking",
            "milestoneId": "mid_m2",
            "seniorBarConcept": "Оптимизация сессии Hibernate: установка FlushMode.MANUAL и отключение снимков состояния сущностей.",
            "interviewTrap": "Мнение, что readOnly = true делает транзакцию строго неизменяемой на уровне базы данных без явной поддержки СУБД.",
            "estimatedMinutes": 15,
            "targetArena": "transactions",
            "targetScenarioId": "readonly_dirty_checking",
            "domain": "transactions",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["mid_step_6"],
            "pedagogicalRationale": "Экономия до 50% CPU и памяти на чтении за счет отключения механизма dirty-checking в Hibernate.",
            "coreRequirements": {
                "theoryTopic": "spring",
                "theoryTitle": "Как аннотация @Transactional(readOnly = true) оптимизирует работу Hibernate Session и JDBC Connection?",
                "taskType": "transactions",
                "targetArena": "transactions",
                "targetScenarioId": "readonly_dirty_checking",
                "taskDescription": "Применить readOnly = true для исключения паразитного обновления сущностей."
            },
            "bonusDeepDive": {
                "title": "⭐ PostgreSQL Read-Only Replica Routing",
                "description": "Маршрутизация запросов с readOnly = true на физические реплики через AbstractRoutingDataSource."
            },
            "masteryChecklist": [
                "Понимание работы Snapshot в Persistence Context",
                "Проверка сценария L0_03 в Transactions Lab"
            ],
            "crossCourseLinks": ["spring3-transactions-master-15:step-4"]
        },
        {
            "stepNumber": 8,
            "title": "Spring Boot Bean Lifecycle & BeanPostProcessor",
            "milestoneId": "mid_m2",
            "seniorBarConcept": "Фазы жизненного цикла: Instantiation -> Populate Properties -> Aware Interfaces -> BeanPostProcessor -> @PostConstruct -> Initialization.",
            "interviewTrap": "Попытка обратиться к полям с @Autowired внутри конструктора до этапа внедрения зависимостей.",
            "estimatedMinutes": 20,
            "targetArena": "theory",
            "targetScenarioId": "spring",
            "domain": "spring",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["mid_step_7"],
            "pedagogicalRationale": "Глубокое понимание жизненного цикла предотвращает NullPointerException при инициализации сервисов.",
            "coreRequirements": {
                "theoryTopic": "spring",
                "theoryTitle": "В какой точке жизненного цикла бина создается CGLIB-прокси для обработки @Transactional и @Async?",
                "taskType": "theory",
                "targetArena": "theory",
                "targetScenarioId": "spring",
                "taskDescription": "Изучить этапы жизненного цикла бина в Базе Знаний."
            },
            "bonusDeepDive": {
                "title": "⭐ SmartInitializingSingleton",
                "description": "Применение интерфейса SmartInitializingSingleton для безопасного прогрева кэшей после старта всех синглтонов."
            },
            "masteryChecklist": [
                "Знание порядка вызова @PostConstruct, InitializingBean, initMethod",
                "Понимание роли BeanPostProcessor"
            ],
            "crossCourseLinks": []
        },
        {
            "stepNumber": 9,
            "title": "Распространение транзакций: REQUIRED против REQUIRES_NEW",
            "milestoneId": "mid_m2",
            "seniorBarConcept": "Приостановка внешней транзакции (Suspension), захват второго JDBC-соединения из пула.",
            "interviewTrap": "Использование REQUIRES_NEW для логирования без учета размера пула HikariCP, вызывающее взаимную блокировку.",
            "estimatedMinutes": 20,
            "targetArena": "transactions",
            "targetScenarioId": "propagation_required_vs_requires_new",
            "domain": "transactions",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["mid_step_8"],
            "pedagogicalRationale": "Основа проектирования независимых аудиторских следов и изоляции критических подсистем.",
            "coreRequirements": {
                "theoryTopic": "spring",
                "theoryTitle": "Сколько соединений с базой данных удерживает поток при вложенном вызове метода с Propagation.REQUIRES_NEW?",
                "taskType": "transactions",
                "targetArena": "transactions",
                "targetScenarioId": "propagation_required_vs_requires_new",
                "taskDescription": "Сконфигурировать Propagation.REQUIRES_NEW для гарантированного сохранения журнала аудита при откате основного заказа."
            },
            "bonusDeepDive": {
                "title": "⭐ JtaTransactionManager & 2PC",
                "description": "Как координируются вложенные транзакции в среде распределенных ресурсов."
            },
            "masteryChecklist": [
                "Понимание удержания двух JDBC соединений",
                "Успешное выполнение сценария L0_04 в Transactions Lab"
            ],
            "crossCourseLinks": ["spring3-transactions-master-15:step-3"]
        },
        {
            "stepNumber": 10,
            "title": "Игнорирование @Transactional на non-public методах",
            "milestoneId": "mid_m2",
            "seniorBarConcept": "По умолчанию Spring AOP прокси перехватывает вызовы исключительно к методам с модификатором public.",
            "interviewTrap": "Добавление @Transactional на package-private или protected метод и ожидание автоматического открытия транзакции.",
            "estimatedMinutes": 15,
            "targetArena": "transactions",
            "targetScenarioId": "private_method_transactional_noop",
            "domain": "transactions",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["mid_step_9"],
            "pedagogicalRationale": "Типичная ошибка Junior/Middle разработчиков, приводящая к бесшумному выполнению операций без транзакционной защиты.",
            "coreRequirements": {
                "theoryTopic": "spring",
                "theoryTitle": "Почему Spring AOP игнорирует аннотации @Transactional на методах с видимостью package-private или protected?",
                "taskType": "transactions",
                "targetArena": "transactions",
                "targetScenarioId": "private_method_transactional_noop",
                "taskDescription": "Исправить видимость метода для корректного перехвата прокси-сервером."
            },
            "bonusDeepDive": {
                "title": "⭐ ArchUnit Rule for Public Transactions",
                "description": "Написание правила ArchUnit, запрещающего аннотацию @Transactional на non-public методах на этапе сборки."
            },
            "masteryChecklist": [
                "Устранение silent no-op бага в Spring Transactions Lab",
                "Понимание ограничений CGLIB подклассов"
            ],
            "crossCourseLinks": ["spring3-transactions-master-15:step-6"]
        },
        {
            "stepNumber": 11,
            "title": "Триаж Deadlock в классической многопоточности (2-Thread Deadlock)",
            "milestoneId": "mid_m3",
            "seniorBarConcept": "Взаимная блокировка потоков: поиск циклического графа ожидания мониторов (Deadlock Cycle).",
            "interviewTrap": "Попытка исправить Deadlock увеличением таймаутов вместо упорядочивания захвата блокировок.",
            "estimatedMinutes": 20,
            "targetArena": "incident_triage",
            "targetScenarioId": "triage-l0-01",
            "domain": "concurrency",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["mid_step_10"],
            "pedagogicalRationale": "Умение читать Thread Dump и находить строку 'Found 1 deadlock' — базовый навык траблшутинга Middle инженера.",
            "coreRequirements": {
                "theoryTopic": "concurrency",
                "theoryTitle": "Как локализовать взаимную блокировку по дампу потоков jstack и как исправить алгоритм через глобальный порядок блокировок?",
                "taskType": "incident_triage",
                "targetArena": "incident_triage",
                "targetScenarioId": "triage-l0-01",
                "taskDescription": "Исследовать 2-thread deadlock дамп в Incident Triage Studio и сформулировать RCA."
            },
            "bonusDeepDive": {
                "title": "⭐ ThreadMXBean & jcmd Thread.dump_to_file",
                "description": "Программный поиск взаимных блокировок в рантайме через findDeadlockedThreads()."
            },
            "masteryChecklist": [
                "Точное определение заблокированных мониторов в трейд-дампе",
                "Успешное закрытие инцидента L0-01"
            ],
            "crossCourseLinks": ["jvm-forensics-triage-12:step-1"]
        },
        {
            "stepNumber": 12,
            "title": "Истощение пула соединений HikariCP (Connection Pool Starvation)",
            "milestoneId": "mid_m3",
            "seniorBarConcept": "Связь пула соединений с потоками выполнения, leakDetectionThreshold, таймаут ожидания соединения.",
            "interviewTrap": "Бесконечное увеличение maximumPoolSize, приводящее к деградации самого PostgreSQL.",
            "estimatedMinutes": 20,
            "targetArena": "incident_triage",
            "targetScenarioId": "triage-l0-03",
            "domain": "transactions",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["mid_step_11"],
            "pedagogicalRationale": "Хрестоматийный инцидент: зависание пула соединений из-за медленных SQL-запросов или утечки транзакций.",
            "coreRequirements": {
                "theoryTopic": "spring",
                "theoryTitle": "По какой формуле рассчитывается оптимальный размер пула соединений HikariCP (pool_size = Tn * (Cm - 1) + 1)?",
                "taskType": "incident_triage",
                "targetArena": "incident_triage",
                "targetScenarioId": "triage-l0-03",
                "taskDescription": "Провести триаж зависшего пула HikariCP в Incident Triage Studio."
            },
            "bonusDeepDive": {
                "title": "⭐ HikariCP Metrics in Prometheus",
                "description": "Мониторинг hikaricp_connection_acquired_nanoseconds и PendingConnections."
            },
            "masteryChecklist": [
                "Понимание метрик HikariCP (Active, Idle, Waiting)",
                "Успешный триаж инцидента L0-03"
            ],
            "crossCourseLinks": ["jvm-forensics-triage-12:step-3"]
        },
        {
            "stepNumber": 13,
            "title": "Утечка Metaspace из-за генерации динамических CGLIB-прокси",
            "milestoneId": "mid_m3",
            "seniorBarConcept": "Заполнение внекучевой памяти классов (Metaspace) при создании уникальных загрузчиков классов без кэширования.",
            "interviewTrap": "Увеличение -Xmx при получении java.lang.OutOfMemoryError: Metaspace.",
            "estimatedMinutes": 20,
            "targetArena": "incident_triage",
            "targetScenarioId": "triage-l0-04",
            "domain": "jvm",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["mid_step_12"],
            "pedagogicalRationale": "Освоение разницы между Heap и Metaspace — важнейший шаг в понимании архитектуры JVM.",
            "coreRequirements": {
                "theoryTopic": "jvm",
                "theoryTitle": "Чем отличается Metaspace в Java 8+ от устаревшей области PermGen, и когда собираются метаданные классов?",
                "taskType": "incident_triage",
                "targetArena": "incident_triage",
                "targetScenarioId": "triage-l0-04",
                "taskDescription": "Изолировать утечку классов в дамп-анализаторе Incident Triage Studio."
            },
            "bonusDeepDive": {
                "title": "⭐ jcmd VM.metaspace & ClassLoader Hierarchy",
                "description": "Диагностика фрагментации метаспейса через встроенные утилиты JDK."
            },
            "masteryChecklist": [
                "Понимание роли ClassLoader в очистке классов сборщиком мусора",
                "Успешное решение инцидента L0-04"
            ],
            "crossCourseLinks": ["jvm-forensics-triage-12:step-4"]
        },
        {
            "stepNumber": 14,
            "title": "Утечка Heap в бесконечной очереди (Unbounded Accumulator)",
            "milestoneId": "mid_m3",
            "seniorBarConcept": "Рост живых объектов в Old Gen из-за статической коллекции или неограниченного буфера.",
            "interviewTrap": "Предположение, что GC всегда спасает от утечек памяти в Java.",
            "estimatedMinutes": 20,
            "targetArena": "incident_triage",
            "targetScenarioId": "triage-l0-02",
            "domain": "jvm",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["mid_step_13"],
            "pedagogicalRationale": "Знакомство с Dominator Tree в Eclipse MAT и поиском объектов, удерживающих гигабайты кучи.",
            "coreRequirements": {
                "theoryTopic": "jvm",
                "theoryTitle": "Как GC Roots удерживают объекты от очистки, и что такое Retained Size в анализе кучи?",
                "taskType": "incident_triage",
                "targetArena": "incident_triage",
                "targetScenarioId": "triage-l0-02",
                "taskDescription": "Найти утекающий накопитель в Incident Triage Studio."
            },
            "bonusDeepDive": {
                "title": "⭐ SoftReference & WeakHashMap",
                "description": "Использование слабых ссылок для предотвращения утечек в кэшах приложений."
            },
            "masteryChecklist": [
                "Умение определять корень утечки памяти по дампам",
                "Успешное завершение сценария L0-02"
            ],
            "crossCourseLinks": ["jvm-forensics-triage-12:step-2"]
        },
        {
            "stepNumber": 15,
            "title": "Mockito 5: Проверка строгого порядка вызовов (InOrder Verification)",
            "milestoneId": "mid_m3",
            "seniorBarConcept": "Использование org.mockito.InOrder для валидации строгой последовательности бизнес-операций.",
            "interviewTrap": "Проверка факта вызова методов без верификации порядка, допускающая списание средств после отклонения платежа.",
            "estimatedMinutes": 20,
            "targetArena": "testing_mutation",
            "targetScenarioId": "kata_test_strict_in_order_audit",
            "domain": "testing",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["mid_step_14"],
            "pedagogicalRationale": "В финансовых и критических системах порядок операций столь же важен, как и их результат.",
            "coreRequirements": {
                "theoryTopic": "core",
                "theoryTitle": "В каких ситуациях простой verify() недостаточен и требуется inOrder.verify()?",
                "taskType": "testing_mutation",
                "targetArena": "testing_mutation",
                "targetScenarioId": "kata_test_strict_in_order_audit",
                "taskDescription": "Написать InOrder-тест, гарантирующий запись в аудит строго до вызова внешнего шлюза."
            },
            "bonusDeepDive": {
                "title": "⭐ ArgumentCaptor & Mockito Verification Modes",
                "description": "Проверка аргументов вызова через ArgumentCaptor и modes.atLeastOnce()."
            },
            "masteryChecklist": [
                "Успешная реализация теста с Mockito InOrder",
                "100% покрытие аудиторской цепочки"
            ],
            "crossCourseLinks": ["testing-mutation-master-15:step-6"]
        },
        {
            "stepNumber": 16,
            "title": "Consistent Hashing Ring & Виртуальные ноды",
            "milestoneId": "mid_m4",
            "seniorBarConcept": "Кольцо согласованного хеширования, минимизация перемещения ключей при масштабировании кластера (k/N).",
            "interviewTrap": "Использование простого hash(key) % N, приводящее к полной инвалидации кэша при добавлении одной ноды.",
            "estimatedMinutes": 20,
            "targetArena": "system_design",
            "targetScenarioId": "hld-micro-01",
            "domain": "system_design",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["mid_step_15"],
            "pedagogicalRationale": "Первый шаг в распределенные системы: понимание принципа шардирования данных без остановки сервиса.",
            "coreRequirements": {
                "theoryTopic": "architecture",
                "theoryTitle": "Зачем в алгоритме Consistent Hashing вводятся виртуальные ноды (V-Nodes)?",
                "taskType": "system_design",
                "targetArena": "system_design",
                "targetScenarioId": "hld-micro-01",
                "taskDescription": "Спроектировать кольцо Consistent Hashing с равномерным распределением ключей."
            },
            "bonusDeepDive": {
                "title": "⭐ MurmurHash3 vs MD5 in Ketama",
                "description": "Выбор быстрой и равномерной хеш-функции для клиентской балансировки."
            },
            "masteryChecklist": [
                "Понимание работы кольца и виртуальных узлов",
                "Решение микро-каты 1 в System Design Arena"
            ],
            "crossCourseLinks": ["highload-system-design-15:step-1"]
        },
        {
            "stepNumber": 17,
            "title": "Защита от Cache Stampede: SingleFlight vs XFetch",
            "milestoneId": "mid_m4",
            "seniorBarConcept": "Предотвращение лавинообразного падения базы данных при истечении TTL популярного ключа (Thundering Herd).",
            "interviewTrap": "Синхронный поход всех параллельных потоков в базу данных при промахе кэша.",
            "estimatedMinutes": 20,
            "targetArena": "system_design",
            "targetScenarioId": "hld-micro-02",
            "domain": "system_design",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["mid_step_16"],
            "pedagogicalRationale": "Обязательный элемент любого высоконагруженного сервиса с кэшированием (Redis / Memcached).",
            "coreRequirements": {
                "theoryTopic": "architecture",
                "theoryTitle": "Как работает вероятностное досрочное обновление кэша (алгоритм XFetch)?",
                "taskType": "system_design",
                "targetArena": "system_design",
                "targetScenarioId": "hld-micro-02",
                "taskDescription": "Спроектировать защиту от Cache Stampede в System Design Arena."
            },
            "bonusDeepDive": {
                "title": "⭐ Mutex Locking in Redis",
                "description": "Сравнение распределенной блокировки Redlock и локального SingleFlight для защиты кэша."
            },
            "masteryChecklist": [
                "Понимание механизмов SingleFlight и вероятностного обновления",
                "Решение микро-каты 2 в System Design Arena"
            ],
            "crossCourseLinks": ["highload-system-design-15:step-2"]
        },
        {
            "stepNumber": 18,
            "title": "Выбор ключа шардирования (Range vs Hash Sharding)",
            "milestoneId": "mid_m4",
            "seniorBarConcept": "Баланс между равномерным распределением нагрузки и эффективностью диапазонных запросов (Range Queries).",
            "interviewTrap": "Выбор monotonic timestamp в качестве ключа шардирования, приводящий к созданию горячего шарда (Hotspot).",
            "estimatedMinutes": 20,
            "targetArena": "system_design",
            "targetScenarioId": "hld-micro-03",
            "domain": "system_design",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["mid_step_17"],
            "pedagogicalRationale": "Умение избегать горячих шардов — фундаментальный критерий оценки архитектурных навыков на собеседовании.",
            "coreRequirements": {
                "theoryTopic": "architecture",
                "theoryTitle": "В каких сценариях Hash-шардирование превосходит Range-шардирование, а когда проигрывает ему?",
                "taskType": "system_design",
                "targetArena": "system_design",
                "targetScenarioId": "hld-micro-03",
                "taskDescription": "Спроектировать схему шардирования для многопользовательского хранилища."
            },
            "bonusDeepDive": {
                "title": "⭐ Compound Shard Keys",
                "description": "Составные ключи шардирования (tenant_id + created_at) в распределенных базах."
            },
            "masteryChecklist": [
                "Обоснованный выбор ключа шардирования",
                "Решение микро-каты 3 в System Design Arena"
            ],
            "crossCourseLinks": ["highload-system-design-15:step-3"]
        },
        {
            "stepNumber": 19,
            "title": "Распределенный Rate Limiter (Token Bucket в Redis)",
            "milestoneId": "mid_m4",
            "seniorBarConcept": "Ограничение частоты запросов: алгоритм Token Bucket с атомарным обновлением через Lua-скрипт в Redis.",
            "interviewTrap": "Реализация проверки и обновления токенов двумя отдельными командами в Redis, приводящая к race condition.",
            "estimatedMinutes": 25,
            "targetArena": "system_design",
            "targetScenarioId": "hld-micro-04",
            "domain": "system_design",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["mid_step_18"],
            "pedagogicalRationale": "Классическая задача системного дизайна: защита API от перегрузок и DDoS-атак.",
            "coreRequirements": {
                "theoryTopic": "architecture",
                "theoryTitle": "Почему в распределенном Rate Limiter критически важно выполнять проверку через единый Lua-скрипт?",
                "taskType": "system_design",
                "targetArena": "system_design",
                "targetScenarioId": "hld-micro-04",
                "taskDescription": "Спроектировать Token Bucket Rate Limiter на холсте System Design."
            },
            "bonusDeepDive": {
                "title": "⭐ Leaky Bucket vs Sliding Window Counter",
                "description": "Сравнение алгоритмов ограничения трафика по расходу памяти и точности."
            },
            "masteryChecklist": [
                "Понимание работы алгоритма Token Bucket",
                "Решение микро-каты 4 в System Design Arena"
            ],
            "crossCourseLinks": ["highload-system-design-15:step-4"]
        },
        {
            "stepNumber": 20,
            "title": "Паттерн Transactional Outbox и CDC (Debezium)",
            "milestoneId": "mid_m4",
            "seniorBarConcept": "Гарантированная отправка событий в брокер (Kafka/RabbitMQ) через запись в таблицу outbox в рамках той же транзакции БД.",
            "interviewTrap": "Прямая отправка в Kafka перед коммитом в БД (событие ушло, а транзакция откатилась).",
            "estimatedMinutes": 25,
            "targetArena": "system_design",
            "targetScenarioId": "hld-micro-07",
            "domain": "system_design",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["mid_step_19"],
            "pedagogicalRationale": "Главный паттерн микросервисной архитектуры для обеспечения надежности доставки сообщений без 2PC.",
            "coreRequirements": {
                "theoryTopic": "architecture",
                "theoryTitle": "Как Transactional Outbox предотвращает дуальную запись (Dual-Write Problem) между БД и Kafka?",
                "taskType": "system_design",
                "targetArena": "system_design",
                "targetScenarioId": "hld-micro-07",
                "taskDescription": "Спроектировать поток событий с Transactional Outbox и Debezium CDC."
            },
            "bonusDeepDive": {
                "title": "⭐ Polling Publisher vs Transaction Log Tailing",
                "description": "Сравнение периодического опроса таблицы outbox и чтения WAL через CDC."
            },
            "masteryChecklist": [
                "Уверенное понимание проблемы Dual-Write",
                "Решение микро-каты 7 в System Design Arena"
            ],
            "crossCourseLinks": ["highload-system-design-15:step-7"]
        }
    ]
}

# 8. Create testing-mutation-master-15 (🧪 Automated & Mutation Testing Master)
testing_track = {
    "id": "testing-mutation-master-15",
    "category": "domain",
    "title": "🧪 Automated & Mutation Testing Master (15 Шагов)",
    "badge": "42 Katas (L0-L3)",
    "totalSteps": 15,
    "difficulty": "solid_senior",
    "estimatedDuration": "2 недели (специализация)",
    "description": "Полный курс по тестированию промышленного Java-кода: от базовых швов легаси-кода и параметризованных тестов до мутационного тестирования PITest, верификации многопоточных гонок и архитектурных фитнес-функций ArchUnit.",
    "milestones": [
        {
            "id": "test_m1",
            "title": "Майлстоун 1: Легаси-швы & Parametric Testing (L0/L1)",
            "stepRange": "1–5"
        },
        {
            "id": "test_m2",
            "title": "Майлстоун 2: Mockito 5 & Недетерминированное время (L2)",
            "stepRange": "6–10"
        },
        {
            "id": "test_m3",
            "title": "Майлстоун 3: Concurrency, Finite Automata & ArchUnit (L3)",
            "stepRange": "11–15"
        }
    ],
    "steps": [
        {
            "stepNumber": 1,
            "title": "Параметризованная валидация финансовых транзакций",
            "milestoneId": "test_m1",
            "seniorBarConcept": "@ParameterizedTest, CsvSource, MethodSource, верификация граничных условий.",
            "interviewTrap": "Пропуск крайних значений нуля и отрицательных балансов в тестах валидатора.",
            "estimatedMinutes": 20,
            "targetArena": "testing_mutation",
            "targetScenarioId": "kata_test_financial_tx_validator",
            "domain": "testing",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": [],
            "pedagogicalRationale": "Освоение параметров и краевых условий валидации.",
            "coreRequirements": {
                "theoryTopic": "core",
                "theoryTitle": "Параметризованное тестирование в JUnit 5",
                "taskType": "testing_mutation",
                "targetArena": "testing_mutation",
                "targetScenarioId": "kata_test_financial_tx_validator",
                "taskDescription": "Покрыть предикатную валидацию транзакций параметризованными тестами."
            },
            "bonusDeepDive": {
                "title": "⭐ Dynamic Tests",
                "description": "Использование @TestFactory для динамической генерации тестовых наборов."
            },
            "masteryChecklist": [
                "Успешное прохождение валидатора финансовых транзакций",
                "Ликвидация всех мутантов"
            ],
            "crossCourseLinks": []
        },
        {
            "stepNumber": 2,
            "title": "Разрыв связности через Subclass & Override Seam (TripService)",
            "milestoneId": "test_m1",
            "seniorBarConcept": "Паттерн Seams для изоляции статического глобального состояния без фреймворков моков.",
            "interviewTrap": "Попытка замокать статические методы через сторонние тяжелые фреймворки.",
            "estimatedMinutes": 20,
            "targetArena": "testing_mutation",
            "targetScenarioId": "kata_test_trip_service_seam",
            "domain": "testing",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["test_step_1"],
            "pedagogicalRationale": "Классическая ката Майкла Физерса по безопасному внедрению тестов в легаси.",
            "coreRequirements": {
                "theoryTopic": "core",
                "theoryTitle": "Subclass & Override Seam Pattern",
                "taskType": "testing_mutation",
                "targetArena": "testing_mutation",
                "targetScenarioId": "kata_test_trip_service_seam",
                "taskDescription": "Изолировать статический синглтон сессии через переопределение protected-метода."
            },
            "bonusDeepDive": {
                "title": "⭐ Mockito static mock",
                "description": "Сравнение mockStatic() в Mockito и архитектурных швов."
            },
            "masteryChecklist": [
                "100% изоляция от статики без изменения внешнего контракта",
                "Успешное прохождение каты TripService"
            ],
            "crossCourseLinks": []
        },
        {
            "stepNumber": 3,
            "title": "Approval Testing & Golden Master (Gilded Rose)",
            "milestoneId": "test_m1",
            "seniorBarConcept": "Эталонные снимки поведения (Approval Testing) для безопасного рефакторинга запутанного кода.",
            "interviewTrap": "Рефакторинг без эталонных тестов, приводящий к регрессионным багам в продакшене.",
            "estimatedMinutes": 25,
            "targetArena": "testing_mutation",
            "targetScenarioId": "kata_test_gilded_rose_approval",
            "domain": "testing",
            "requiredForGrade": "L4",
            "prerequisiteStepIds": ["test_step_2"],
            "pedagogicalRationale": "Формирование привычки создавать Golden Master перед любым изменением архитектуры.",
            "coreRequirements": {
                "theoryTopic": "core",
                "theoryTitle": "Approval Testing Methodology",
                "taskType": "testing_mutation",
                "targetArena": "testing_mutation",
                "targetScenarioId": "kata_test_gilded_rose_approval",
                "taskDescription": "Сформировать матрицу проверок и зафиксировать эталонное поведение Gilded Rose."
            },
            "bonusDeepDive": {
                "title": "⭐ Text-based vs JSON Snapshots",
                "description": "Сравнение форматов сериализации для Approval Testing."
            },
            "masteryChecklist": [
                "Покрытие всех категорий товаров",
                "Успешный прогон Golden Master"
            ],
            "crossCourseLinks": []
        },
        {
            "stepNumber": 4,
            "title": "Детерминированное время: Overloaded Constructor Clock Seam",
            "milestoneId": "test_m1",
            "seniorBarConcept": "Инъекция java.time.Clock через перегруженный конструктор вместо прямого вызова Instant.now().",
            "interviewTrap": "Использование Thread.sleep() в тестах для проверки истечения таймаутов.",
            "estimatedMinutes": 20,
            "targetArena": "testing_mutation",
            "targetScenarioId": "kata_test_overloaded_constructor_clock_seam",
            "domain": "testing",
            "requiredForGrade": "L5",
            "prerequisiteStepIds": ["test_step_3"],
            "pedagogicalRationale": "Жесткий инвариант платформы: нулевое использование System.currentTimeMillis() и детерминированное тестирование в 0мс.",
            "coreRequirements": {
                "theoryTopic": "core",
                "theoryTitle": "Time Virtualization & Clock.fixed()",
                "taskType": "testing_mutation",
                "targetArena": "testing_mutation",
                "targetScenarioId": "kata_test_overloaded_constructor_clock_seam",
                "taskDescription": "Внедрить java.time.Clock через конструктор и протестировать скользящее окно в 0мс."
            },
            "bonusDeepDive": {
                "title": "⭐ Clock.offset() & ZoneId",
                "description": "Тестирование переходов на летнее время и часовых поясов."
            },
            "masteryChecklist": [
                "Устранение Flaky-тестов на время",
                "Успешное прохождение каты Clock Seam"
            ],
            "crossCourseLinks": []
        },
        {
            "stepNumber": 5,
            "title": "Тестирование конечных автоматов: Order State Machine",
            "milestoneId": "test_m1",
            "seniorBarConcept": "Тестирование валидных и невалидных переходов состояний (Finite State Automata).",
            "interviewTrap": "Отсутствие тестов на запрещенные переходы состояний (например, из CANCELLED в DELIVERED).",
            "estimatedMinutes": 25,
            "targetArena": "testing_mutation",
            "targetScenarioId": "kata_test_order_state_machine_dynamic",
            "domain": "testing",
            "requiredForGrade": "L5",
            "prerequisiteStepIds": ["test_step_4"],
            "pedagogicalRationale": "Основа надежности e-commerce и платежных систем.",
            "coreRequirements": {
                "theoryTopic": "core",
                "theoryTitle": "FSM Verification Patterns",
                "taskType": "testing_mutation",
                "targetArena": "testing_mutation",
                "targetScenarioId": "kata_test_order_state_machine_dynamic",
                "taskDescription": "Покрыть полную матрицу переходов автомата заказа тестами."
            },
            "bonusDeepDive": {
                "title": "⭐ Spring Statemachine Testing",
                "description": "Тестирование состояний с использованием Spring Statemachine TestKit."
            },
            "masteryChecklist": [
                "Проверка всех допустимых переходов",
                "Ассерты на выброс IllegalStateException при некорректных переходах"
            ],
            "crossCourseLinks": []
        },
        {
            "stepNumber": 6,
            "title": "Строгий порядок вызовов: InOrder Audit Trail",
            "milestoneId": "test_m2",
            "seniorBarConcept": "Верификация строгой последовательности вызовов в Mockito (InOrder).",
            "interviewTrap": "Проверка факта вызова без проверки порядка операций аудита.",
            "estimatedMinutes": 20,
            "targetArena": "testing_mutation",
            "targetScenarioId": "kata_test_strict_in_order_audit",
            "domain": "testing",
            "requiredForGrade": "L5",
            "prerequisiteStepIds": ["test_step_5"],
            "pedagogicalRationale": "Гарантия строгого соблюдения последовательности действий в аудите.",
            "coreRequirements": {
                "theoryTopic": "core",
                "theoryTitle": "InOrder Verification in Mockito",
                "taskType": "testing_mutation",
                "targetArena": "testing_mutation",
                "targetScenarioId": "kata_test_strict_in_order_audit",
                "taskDescription": "Написать InOrder тест на сохранение аудита перед сетевым запросом."
            },
            "bonusDeepDive": {
                "title": "⭐ Mockito.verifyNoMoreInteractions()",
                "description": "Гарантия отсутствия паразитных побочных эффектов."
            },
            "masteryChecklist": [
                "Успешная верификация порядка вызовов",
                "Устранение всех мутантов порядка"
            ],
            "crossCourseLinks": []
        },
        {
            "stepNumber": 7,
            "title": "Идемпотентный сервис счетов: Double-Spending Guard",
            "milestoneId": "test_m2",
            "seniorBarConcept": "Тестирование защиты от повторного списания (Double-Spending) с использованием ключей идемпотентности.",
            "interviewTrap": "Тестирование идемпотентности только в один поток без симуляции параллельных конкурентных запросов.",
            "estimatedMinutes": 25,
            "targetArena": "testing_mutation",
            "targetScenarioId": "kata_test_idempotent_account_service",
            "domain": "testing",
            "requiredForGrade": "L5",
            "prerequisiteStepIds": ["test_step_6"],
            "pedagogicalRationale": "Критический навык для FinTech разработки: тестирование финансовых инвариантов.",
            "coreRequirements": {
                "theoryTopic": "core",
                "theoryTitle": "Idempotency Key Testing & Concurrency",
                "taskType": "testing_mutation",
                "targetArena": "testing_mutation",
                "targetScenarioId": "kata_test_idempotent_account_service",
                "taskDescription": "Реализовать тест защиты от двойного списания при параллельных вызовах."
            },
            "bonusDeepDive": {
                "title": "⭐ Distributed Lock Testing",
                "description": "Тестирование сбоев распределенных блокировок при удержании идемпотентности."
            },
            "masteryChecklist": [
                "Гарантия сохранения баланса счета",
                "Успешное прохождение каты Idempotent Account"
            ],
            "crossCourseLinks": []
        },
        {
            "stepNumber": 8,
            "title": "Resilience4j Circuit Breaker: Тестирование переходов состояний",
            "milestoneId": "test_m2",
            "seniorBarConcept": "Тестирование перехода состояний Circuit Breaker: CLOSED -> OPEN -> HALF_OPEN.",
            "interviewTrap": "Неполное тестирование фазы HALF_OPEN и сброса счетчиков неудач.",
            "estimatedMinutes": 25,
            "targetArena": "testing_mutation",
            "targetScenarioId": "kata_test_resilience_circuit_breaker",
            "domain": "testing",
            "requiredForGrade": "L5",
            "prerequisiteStepIds": ["test_step_7"],
            "pedagogicalRationale": "Обеспечение отказоустойчивости микросервисной сети через тестирование предохранителей.",
            "coreRequirements": {
                "theoryTopic": "core",
                "theoryTitle": "Testing Circuit Breakers with Mocked Clocks",
                "taskType": "testing_mutation",
                "targetArena": "testing_mutation",
                "targetScenarioId": "kata_test_resilience_circuit_breaker",
                "taskDescription": "Протестировать переход Circuit Breaker в OPEN при превышении процента сбоев."
            },
            "bonusDeepDive": {
                "title": "⭐ Fallback Method Verification",
                "description": "Тестирование выполнения fallback методов при активном состоянии OPEN."
            },
            "masteryChecklist": [
                "Тестирование всех трех состояний автомата",
                "Успешное прохождение каты Circuit Breaker"
            ],
            "crossCourseLinks": []
        },
        {
            "stepNumber": 9,
            "title": "Изоляция статического контекста безопасности (Security Context Seam)",
            "milestoneId": "test_m2",
            "seniorBarConcept": "Изоляция SecurityContextHolder / Ambient Context для безопасного параллельного запуска тестов.",
            "interviewTrap": "Утечка аутентификации между тестовыми методами из-за статического ThreadLocal.",
            "estimatedMinutes": 20,
            "targetArena": "testing_mutation",
            "targetScenarioId": "kata_test_legacy_security_context_seam",
            "domain": "testing",
            "requiredForGrade": "L5",
            "prerequisiteStepIds": ["test_step_8"],
            "pedagogicalRationale": "Предотвращение взаимного загрязнения состояния в параллельных тест-сьютах.",
            "coreRequirements": {
                "theoryTopic": "core",
                "theoryTitle": "SecurityContextHolder Test Isolation",
                "taskType": "testing_mutation",
                "targetArena": "testing_mutation",
                "targetScenarioId": "kata_test_legacy_security_context_seam",
                "taskDescription": "Обеспечить гарантированную очистку SecurityContext после каждого теста."
            },
            "bonusDeepDive": {
                "title": "⭐ @WithMockUser in Spring Security Test",
                "description": "Использование аннотаций Spring Security для управления аутентификацией."
            },
            "masteryChecklist": [
                "Исключение утечек ThreadLocal между тестами",
                "Успешное прохождение каты Security Seam"
            ],
            "crossCourseLinks": []
        },
        {
            "stepNumber": 10,
            "title": "Недетерминированный финансовый движок (Tax Engine Golden Master)",
            "milestoneId": "test_m2",
            "seniorBarConcept": "Тестирование сложных финансовых калькуляторов с нелинейными шкалами и округлениями.",
            "interviewTrap": "Использование double/float в финансовых расчетах вместо BigDecimal с Banker's Rounding.",
            "estimatedMinutes": 25,
            "targetArena": "testing_mutation",
            "targetScenarioId": "kata_test_legacy_tax_engine_golden_master",
            "domain": "testing",
            "requiredForGrade": "L5",
            "prerequisiteStepIds": ["test_step_9"],
            "pedagogicalRationale": "Жесткое соблюдение финансового инварианта платформы: BigDecimal HALF_EVEN.",
            "coreRequirements": {
                "theoryTopic": "core",
                "theoryTitle": "Financial Precision & RoundingMode.HALF_EVEN",
                "taskType": "testing_mutation",
                "targetArena": "testing_mutation",
                "targetScenarioId": "kata_test_legacy_tax_engine_golden_master",
                "taskDescription": "Зафиксировать золотой мастер финансового налогового движка с точностью до копейки."
            },
            "bonusDeepDive": {
                "title": "⭐ AST Rule: no-double-in-money",
                "description": "Статический анализ запрета примитивных чисел с плавающей точкой в финансовых сервисах."
            },
            "masteryChecklist": [
                "Исключение ошибок округления",
                "Успешное прохождение каты Tax Engine"
            ],
            "crossCourseLinks": []
        },
        {
            "stepNumber": 11,
            "title": "Тестирование асинхронности: Awaitility Polling",
            "milestoneId": "test_m3",
            "seniorBarConcept": "Ожидание завершения асинхронных фоновых задач с помощью Awaitility без Thread.sleep().",
            "interviewTrap": "Жесткие тайм-ауты в Thread.sleep(), замедляющие сборку в десятки раз.",
            "estimatedMinutes": 25,
            "targetArena": "testing_mutation",
            "targetScenarioId": "kata_test_financial_tx_validator",
            "domain": "testing",
            "requiredForGrade": "L5",
            "prerequisiteStepIds": ["test_step_10"],
            "pedagogicalRationale": "Быстрые и детерминированные тесты асинхронного кода.",
            "coreRequirements": {
                "theoryTopic": "core",
                "theoryTitle": "Awaitility Asynchronous Testing Patterns",
                "taskType": "testing_mutation",
                "targetArena": "testing_mutation",
                "targetScenarioId": "kata_test_financial_tx_validator",
                "taskDescription": "Заменить sleep на await().atMost().untilAsserted()."
            },
            "bonusDeepDive": {
                "title": "⭐ PollingInterval & ConditionEvaluationListener",
                "description": "Тонкая настройка интервалов опроса для минимизации нагрузки на CPU."
            },
            "masteryChecklist": [
                "Исключение Flaky асинхронных тестов",
                "Быстрое прохождение тестов"
            ],
            "crossCourseLinks": []
        },
        {
            "stepNumber": 12,
            "title": "Многопоточный барьер: CyclicBarrier & CountDownLatch",
            "milestoneId": "test_m3",
            "seniorBarConcept": "Синхронизация старта сотен параллельных потоков для воспроизведения race conditions.",
            "interviewTrap": "Запуск потоков без барьера, приводящий к последовательному выполнению вместо параллельного шторма.",
            "estimatedMinutes": 25,
            "targetArena": "testing_mutation",
            "targetScenarioId": "kata_test_idempotent_account_service",
            "domain": "testing",
            "requiredForGrade": "L6",
            "prerequisiteStepIds": ["test_step_11"],
            "pedagogicalRationale": "Стресс-тестирование конкурентных алгоритмов на наличие гонок данных.",
            "coreRequirements": {
                "theoryTopic": "concurrency",
                "theoryTitle": "Reproducing Data Races with CyclicBarrier",
                "taskType": "testing_mutation",
                "targetArena": "testing_mutation",
                "targetScenarioId": "kata_test_idempotent_account_service",
                "taskDescription": "Организовать одновременный старт 50 потоков для атаки на баланс счета."
            },
            "bonusDeepDive": {
                "title": "⭐ jcstress (Java Concurrency Stress)",
                "description": "Формальное тестирование моделей памяти с использованием OpenJDK jcstress."
            },
            "masteryChecklist": [
                "Надежное воспроизведение гонки данных",
                "Верификация thread-safety гарантий"
            ],
            "crossCourseLinks": []
        },
        {
            "stepNumber": 13,
            "title": "Архитектурные фитнес-функции: ArchUnit Layer Isolation",
            "milestoneId": "test_m3",
            "seniorBarConcept": "Автоматическая валидация чистой архитектуры (Clean Architecture) через ArchUnit тесты в CI/CD.",
            "interviewTrap": "Контроль архитектурных слоев исключительно через код-ревью, приводящий к эрозии границ.",
            "estimatedMinutes": 25,
            "targetArena": "testing_mutation",
            "targetScenarioId": "kata_test_financial_tx_validator",
            "domain": "testing",
            "requiredForGrade": "L6",
            "prerequisiteStepIds": ["test_step_12"],
            "pedagogicalRationale": "Превращение архитектурных правил в автоматизированные компилируемые тесты.",
            "coreRequirements": {
                "theoryTopic": "architecture",
                "theoryTitle": "ArchUnit Architectural Fitness Functions",
                "taskType": "testing_mutation",
                "targetArena": "testing_mutation",
                "targetScenarioId": "kata_test_financial_tx_validator",
                "taskDescription": "Написать правило ArchUnit, запрещающее контроллерам обращаться к репозиториям в обход сервисов."
            },
            "bonusDeepDive": {
                "title": "⭐ Freezing ArchRules",
                "description": "Заморозка существующих нарушений в легаси-проектах через FreezingArchRule."
            },
            "masteryChecklist": [
                "Успешная реализация ArchUnit теста на изоляцию слоев",
                "Защита доменного слоя от инфраструктурных зависимостей"
            ],
            "crossCourseLinks": []
        },
        {
            "stepNumber": 14,
            "title": "ArchUnit: Контроль транзакционной целостности (@Transactional)",
            "milestoneId": "test_m3",
            "seniorBarConcept": "Проверка отсутствия @Transactional на методах контроллеров и приватных методах.",
            "interviewTrap": "Размещение @Transactional на endpoint-контроллерах, удерживающее соединение на время сериализации JSON.",
            "estimatedMinutes": 20,
            "targetArena": "testing_mutation",
            "targetScenarioId": "kata_test_strict_in_order_audit",
            "domain": "testing",
            "requiredForGrade": "L6",
            "prerequisiteStepIds": ["test_step_13"],
            "pedagogicalRationale": "Автоматический аудит кода против типичных транзакционных антипаттернов.",
            "coreRequirements": {
                "theoryTopic": "spring",
                "theoryTitle": "Static Audit of @Transactional with ArchUnit",
                "taskType": "testing_mutation",
                "targetArena": "testing_mutation",
                "targetScenarioId": "kata_test_strict_in_order_audit",
                "taskDescription": "Сформировать правило ArchUnit, запрещающее @Transactional на уровне Web MVC."
            },
            "bonusDeepDive": {
                "title": "⭐ Custom ArchCondition",
                "description": "Реализация пользовательских предикатов для проверки атрибутов аннотаций."
            },
            "masteryChecklist": [
                "Исключение утечек транзакций в Web слой",
                "Успешное прохождение архитектурной валидации"
            ],
            "crossCourseLinks": []
        },
        {
            "stepNumber": 15,
            "title": "Маскирование конфиденциальных данных (PAN & PII Masking)",
            "milestoneId": "test_m3",
            "seniorBarConcept": "Тестирование кастомных Jackson-сериализаторов для маскирования номеров банковских карт и персональных данных в логах.",
            "interviewTrap": "Логирование полного номера карты (PAN) в продакшене, нарушающее стандарт PCI DSS.",
            "estimatedMinutes": 25,
            "targetArena": "testing_mutation",
            "targetScenarioId": "kata_test_financial_tx_validator",
            "domain": "testing",
            "requiredForGrade": "L6",
            "prerequisiteStepIds": ["test_step_14"],
            "pedagogicalRationale": "Информационная безопасность и комплаенс в BigTech и FinTech системах.",
            "coreRequirements": {
                "theoryTopic": "core",
                "theoryTitle": "PCI DSS Compliance & Jackson Serializer Testing",
                "taskType": "testing_mutation",
                "targetArena": "testing_mutation",
                "targetScenarioId": "kata_test_financial_tx_validator",
                "taskDescription": "Протестировать маскирование номера карты (4111 **** **** 1111) при сериализации в JSON."
            },
            "bonusDeepDive": {
                "title": "⭐ Logback Masking Pattern",
                "description": "Маскирование конфиденциальных данных на уровне регулярных выражений логгера."
            },
            "masteryChecklist": [
                "100% защита персональных данных в логах",
                "Успешное прохождение каты PAN Masking"
            ],
            "crossCourseLinks": []
        }
    ]
}

# Add new roadmaps if not present, otherwise update
new_roadmaps = []
for rm in roadmaps:
    new_roadmaps.append(rm)

# Check if middle-java-spring-20 already exists
if not any(r['id'] == 'middle-java-spring-20' for r in new_roadmaps):
    # Insert right before senior-bigtech-sprint-25 or at front
    new_roadmaps.insert(0, middle_track)
    print("Added middle-java-spring-20 to catalog")
else:
    for i, r in enumerate(new_roadmaps):
        if r['id'] == 'middle-java-spring-20':
            new_roadmaps[i] = middle_track
            print("Updated middle-java-spring-20")

# Check if testing-mutation-master-15 exists
if not any(r['id'] == 'testing-mutation-master-15' for r in new_roadmaps):
    new_roadmaps.append(testing_track)
    print("Added testing-mutation-master-15 to catalog")
else:
    for i, r in enumerate(new_roadmaps):
        if r['id'] == 'testing-mutation-master-15':
            new_roadmaps[i] = testing_track
            print("Updated testing-mutation-master-15")

with open(ROADMAPS_FILE, 'w', encoding='utf-8') as f:
    json.dump(new_roadmaps, f, ensure_ascii=False, indent=2)

print(f"Successfully saved {len(new_roadmaps)} roadmaps to {ROADMAPS_FILE}")
