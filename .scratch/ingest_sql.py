import json

challenges = [
    {
        'id': 'sql-alfa-01',
        'slug': 'sql-alfa-01',
        'title': 'Покупатели Laptop и Monitor одновременно (INTERSECT vs HAVING)',
        'category': 'relational_algebra',
        'difficulty': 'middle',
        'tags': ['HAVING', 'INTERSECT', 'DISTINCT', 'Sets'],
        'companyContext': 'Альфа-Банк (Alfa Digital) — SQL скрининг Middle / Middle+',
        'instructionsMarkdown': 'Вывести имена (`customer.name`) покупателей, каждый из которых приобрёл и **\'Laptop\'**, и **\'Monitor\'** в марте 2024 года. Запрещено дублировать строки. Сортировка по имени.',
        'schemaSql': 'CREATE TABLE customer (customer_key INT PRIMARY KEY, name VARCHAR(100));\nCREATE TABLE product (product_key INT PRIMARY KEY, name VARCHAR(100));\nCREATE TABLE purchase (customer_key INT, product_key INT, date DATE);',
        'seedSql': "INSERT INTO customer VALUES (1, 'Иван Иванов'), (2, 'Петр Петров'), (3, 'Анна Смирнова'), (4, 'Ольга Сидорова');\nINSERT INTO product VALUES (10, 'Laptop'), (20, 'Monitor'), (30, 'Mouse');\nINSERT INTO purchase VALUES (1, 10, '2024-03-05'), (1, 20, '2024-03-12'), (2, 10, '2024-03-01'), (3, 20, '2024-03-15'), (4, 10, '2024-03-10'), (4, 20, '2024-03-11'), (4, 30, '2024-03-15');",
        'expectedQuery': "SELECT c.name\nFROM customer c\nJOIN purchase p ON c.customer_key = p.customer_key\nJOIN product pr ON p.product_key = pr.product_key\nWHERE pr.name IN ('Laptop', 'Monitor')\n  AND p.date >= '2024-03-01' AND p.date < '2024-04-01'\nGROUP BY c.customer_key, c.name\nHAVING COUNT(DISTINCT pr.name) = 2\nORDER BY c.name;",
        'initialEditorSql': '-- Напишите запрос, возвращающий имена покупателей Laptop и Monitor в марте 2024\nSELECT c.name\nFROM customer c\n',
        'orderMatters': True,
        'explanationMarkdown': 'Использование GROUP BY + HAVING COUNT(DISTINCT pr.name) = 2 гарантирует однократное сканирование таблицы purchase без накладных расходов на материализацию множеств в INTERSECT.'
    },
    {
        'id': 'sql-alfa-02',
        'slug': 'sql-alfa-02',
        'title': 'Средний возраст клиентов Smartwatch (Устранение JOIN Fan-Out)',
        'category': 'aggregation',
        'difficulty': 'middle',
        'tags': ['JOIN Fan-Out', 'EXISTS', 'AVG', 'Subqueries'],
        'companyContext': 'Альфа-Банк (Alfa Digital) — Аналитические ловушки при связях 1:M',
        'instructionsMarkdown': 'Рассчитайте средний возраст (`avg_age`, округлить до 2 знаков) клиентов, купивших хотя бы один `Smartwatch` в 2024 году. Защитите расчет от искажения из-за повторных покупок одним клиентом (JOIN Fan-Out).',
        'schemaSql': 'CREATE TABLE clients (id INT PRIMARY KEY, name VARCHAR(100), age INT);\nCREATE TABLE items (id INT PRIMARY KEY, name VARCHAR(100));\nCREATE TABLE orders (id INT PRIMARY KEY, client_id INT, item_id INT, order_date DATE);',
        'seedSql': "INSERT INTO clients VALUES (1, 'Алексей', 25), (2, 'Мария', 35), (3, 'Дмитрий', 45);\nINSERT INTO items VALUES (101, 'Smartwatch'), (102, 'Smartphone');\nINSERT INTO orders VALUES (1, 1, 101, '2024-02-10'), (2, 1, 101, '2024-05-15'), (3, 1, 101, '2024-08-20'), (4, 2, 101, '2024-03-01'), (5, 3, 102, '2024-04-10');",
        'expectedQuery': "SELECT ROUND(AVG(c.age)::numeric, 2) AS avg_age\nFROM clients c\nWHERE EXISTS (\n    SELECT 1\n    FROM orders o\n    JOIN items i ON o.item_id = i.id\n    WHERE o.client_id = c.id\n      AND i.name = 'Smartwatch'\n      AND o.order_date >= '2024-01-01'\n      AND o.order_date < '2025-01-01'\n);",
        'initialEditorSql': '-- Рассчитайте средний возраст без искажения дубликатами\nSELECT ROUND(AVG(c.age)::numeric, 2) AS avg_age\nFROM clients c\n',
        'orderMatters': False,
        'explanationMarkdown': 'Обычный JOIN клиентов с заказами приводит к умножению строк клиента Алексея (3 заказа), сдвигая средний возраст в сторону его 25 лет. Фильтрация через EXISTS исключает Fan-Out.'
    },
    {
        'id': 'sql-alfa-03',
        'slug': 'sql-alfa-03',
        'title': 'Кредитная воронка: Конверсия view_offer в apply_loan',
        'category': 'funnel_analytics',
        'difficulty': 'middle_plus',
        'tags': ['CTE', 'NULLIF', 'Conversion', 'FinTech'],
        'companyContext': 'Альфа-Банк (Alfa Digital) — Расчет кредитных конверсий',
        'instructionsMarkdown': 'Рассчитайте число просмотров оффера (`views_count`), число поданных заявок (`applications_count`) и конверсию в процентах (`conversion_rate_pct`, округление до 2 знаков). Защитите формулу от деления на ноль.',
        'schemaSql': 'CREATE TABLE users (id INT PRIMARY KEY, registered_at TIMESTAMP);\nCREATE TABLE actions (id INT PRIMARY KEY, action_name VARCHAR(50));\nCREATE TABLE users_actions (id INT PRIMARY KEY, user_id INT, action_id INT, created_at TIMESTAMP);',
        'seedSql': "INSERT INTO users VALUES (1, '2024-01-01 10:00:00'), (2, '2024-01-02 11:00:00'), (3, '2024-01-03 12:00:00');\nINSERT INTO actions VALUES (1, 'view_offer'), (2, 'apply_loan'), (3, 'sign_contract');\nINSERT INTO users_actions VALUES (1, 1, 1, '2024-01-01 10:05:00'), (2, 1, 2, '2024-01-01 10:15:00'), (3, 2, 1, '2024-01-02 11:05:00');",
        'expectedQuery': "WITH views AS (\n    SELECT DISTINCT user_id FROM users_actions ua JOIN actions a ON ua.action_id = a.id WHERE a.action_name = 'view_offer'\n),\napplications AS (\n    SELECT DISTINCT user_id FROM users_actions ua JOIN actions a ON ua.action_id = a.id WHERE a.action_name = 'apply_loan'\n)\nSELECT \n    COUNT(v.user_id) AS views_count,\n    COUNT(a.user_id) AS applications_count,\n    ROUND((COUNT(a.user_id)::numeric / NULLIF(COUNT(v.user_id), 0)) * 100, 2) AS conversion_rate_pct\nFROM views v\nLEFT JOIN applications a ON v.user_id = a.user_id;",
        'initialEditorSql': '-- Расчет воронки конверсии оффера в заявку\nWITH views AS (\n  SELECT DISTINCT user_id FROM users_actions\n)\n',
        'orderMatters': False,
        'explanationMarkdown': 'Использование CTE для изолированной дедупликации пользователей на шагах воронки и NULLIF гарантирует корректность метрик и защиту от Division by Zero.'
    },
    {
        'id': 'sql-alfa-04',
        'slug': 'sql-alfa-04',
        'title': 'Топ-3 категории по кэшбэку за июнь 2025 года (DENSE_RANK)',
        'category': 'window_functions',
        'difficulty': 'middle',
        'tags': ['DENSE_RANK', 'Window Functions', 'Anti-LIMIT', 'Banking'],
        'companyContext': 'Альфа-Банк (Alfa Digital) — Программа лояльности и кэшбэк',
        'instructionsMarkdown': 'Вывести категории с суммой кэшбэка (`category_name`, `total_cashback`, `rnk`), входящие в Топ-3 за июнь 2025 года. Использовать `DENSE_RANK()`, так как `LIMIT 3` отсекает категории с равными выплатами.',
        'schemaSql': 'CREATE TABLE cashback_operations (id INT PRIMARY KEY, category_name VARCHAR(100), cashback_amount NUMERIC(12,2), operation_date DATE);',
        'seedSql': "INSERT INTO cashback_operations VALUES (1, 'Супермаркеты', 5000.00, '2025-06-05'), (2, 'Рестораны', 5000.00, '2025-06-10'), (3, 'АЗС', 4200.00, '2025-06-12'), (4, 'Аптеки', 4200.00, '2025-06-15'), (5, 'Такси', 3100.00, '2025-06-20'), (6, 'Одежда', 1500.00, '2025-06-25'), (7, 'Супермаркеты', 1200.00, '2025-05-20');",
        'expectedQuery': "WITH ranked_categories AS (\n    SELECT \n        category_name,\n        SUM(cashback_amount) AS total_cashback,\n        DENSE_RANK() OVER (ORDER BY SUM(cashback_amount) DESC) AS rnk\n    FROM cashback_operations\n    WHERE operation_date >= '2025-06-01' AND operation_date < '2025-07-01'\n    GROUP BY category_name\n)\nSELECT category_name, total_cashback, rnk\nFROM ranked_categories\nWHERE rnk <= 3\nORDER BY rnk, category_name;",
        'initialEditorSql': '-- Напишите запрос с DENSE_RANK() для ранжирования категорий\n',
        'orderMatters': True,
        'explanationMarkdown': 'В банках LIMIT 3 не детерминирован при совпадении сумм. DENSE_RANK() гарантирует, что все категории, разделившие 1, 2 или 3 призовые места, попадают в отчет.'
    },
    {
        'id': 'sql-alfa-05',
        'slug': 'sql-alfa-05',
        'title': 'Оконные функции: 5-я покупка по городам (ROW_NUMBER)',
        'category': 'window_functions',
        'difficulty': 'middle_plus',
        'tags': ['ROW_NUMBER', 'PARTITION BY', 'Window Functions'],
        'companyContext': 'Альфа-Банк (Alfa Digital) — Партиционирование оконных функций',
        'instructionsMarkdown': 'Для каждого города (`town`) вывести стоимость ровно 5-й по счету покупки (`fifth_purchase_amount`). Города с менее чем 5 покупками не выводить. Сортировка по городу.',
        'schemaSql': 'CREATE TABLE city_purchases (id INT PRIMARY KEY, town VARCHAR(100), amount NUMERIC(10,2), purchase_date TIMESTAMP);',
        'seedSql': "INSERT INTO city_purchases VALUES (1, 'Москва', 100.00, '2024-01-01 10:00:00'), (2, 'Москва', 200.00, '2024-01-01 11:00:00'), (3, 'Москва', 300.00, '2024-01-01 12:00:00'), (4, 'Москва', 400.00, '2024-01-01 13:00:00'), (5, 'Москва', 555.00, '2024-01-01 14:00:00'), (6, 'Москва', 600.00, '2024-01-01 15:00:00'), (7, 'Тула', 50.00, '2024-01-02 10:00:00'), (8, 'Тула', 60.00, '2024-01-02 11:00:00'), (9, 'Тула', 70.00, '2024-01-02 12:00:00'), (10, 'Тула', 80.00, '2024-01-02 13:00:00'), (11, 'Тула', 999.00, '2024-01-02 14:00:00'), (12, 'СПб', 10.00, '2024-01-03 10:00:00');",
        'expectedQuery': "WITH numbered AS (\n    SELECT \n        town, \n        amount, \n        ROW_NUMBER() OVER (PARTITION BY town ORDER BY purchase_date) AS purchase_num\n    FROM city_purchases\n)\nSELECT town, amount AS fifth_purchase_amount\nFROM numbered\nWHERE purchase_num = 5\nORDER BY town;",
        'initialEditorSql': '-- Оконная функция с PARTITION BY town\n',
        'orderMatters': True,
        'explanationMarkdown': 'ROW_NUMBER() OVER (PARTITION BY town ORDER BY purchase_date) независимо нумерует покупки внутри каждого города, позволяя точно отфильтровать 5-е событие.'
    }
]

with open('json/sql_challenges.json', 'r', encoding='utf-8') as f:
    existing = json.load(f)

updated = [c for c in existing if c['id'] not in {nc['id'] for nc in challenges}]
updated.extend(challenges)

with open('json/sql_challenges.json', 'w', encoding='utf-8') as f:
    json.dump(updated, f, indent=2, ensure_ascii=False)

print(f'Successfully ingested {len(challenges)} Alfa SQL challenges! Total in JSON: {len(updated)}')
