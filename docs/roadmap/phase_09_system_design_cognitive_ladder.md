# 📐 Этап 9: System Design Arena Cognitive Ladder (От микро-блоков к распределенным гигантам)

> **Статус:** Завершено (Сентябрь 2026)  
> **Цель:** Ликвидировать самую опасную «дырявую лестницу» платформы — скачок неподготовленного кандидата сразу в проектирование Ticketmaster на 100k RPS. Внедрить микро-каты базовых строительных блоков (L0), калькулятор прикидок Back-of-the-Envelope (L1), архитектурный рефакторинг узких мест (L2) и **System Design Compass** (`Ctrl + /`).  
> **Трудозатраты:** Завершено за 1 день | **Приоритет:** P1  
> **Связанные документы:** [system_design_scenarios.json](file:///d:/projects/interview_projects/spring/json/system_design_scenarios.json), [SystemDesignArena.tsx](file:///d:/projects/interview_projects/spring/frontend/src/components/system_design/SystemDesignArena.tsx)

---

## 1. Диагностика «Дырявой лестницы»

Сейчас в каталоге [system_design_scenarios.json](file:///d:/projects/interview_projects/spring/json/system_design_scenarios.json) содержалось 20 сценариев (Uber H3, Netflix CDN, Stripe Ledger, WhatsApp, Ticketmaster).
Однако новичок или Middle-разработчик сталкивается с:
1. **Параличом чистого холста**: Непонимание, с какого сервиса начать декомпозицию (Read Path vs Write Path).
2. **Арифметическим шоком**: Неумение мгновенно переводить 50 млн DAU в QPS, IOPS, объем дисков и пропускную способность сетевых интерфейсов.
3. **Отсутствием понимания строительных кирпичиков**: Кандидат пытается использовать Redis там, где нужен Kafka, или шардировать базу по случайному UUID, теряя возможность выборки по диапазонам.

---

## 2. Новая 4-уровневая структура System Design Arena (Реализовано: 31 сценарий)

```mermaid
graph TD
    subgraph L0 ["🧱 L0: Distributed Building Blocks (8 Микро-кат)"]
        B01["L0-01: Consistent Hashing Ring (Виртуальные ноды)"]
        B02["L0-02: Cache Stampede (SingleFlight / XFetch)"]
        B03["L0-03: Sharding Key Selection (Range vs Hash Hot-spotting)"]
        B04["L0-04: Distributed Rate Limiter (Token Bucket / Sliding Window)"]
        B05["L0-05: Idempotent Consumer & Deduplication (Outbox / Idempotency Key)"]
        B06["L0-06: Read-After-Write Consistency (Replication Lag Guard)"]
        B07["L0-07: Distributed ID Generator (Snowflake 64-bit)"]
        B08["L0-08: Write-Ahead Log & LSM-Tree (WAL Append + MemTable)"]
    end

    subgraph L1 ["🧮 L1: Back-of-the-Envelope Math Coach"]
        M01["Интерактивный калькулятор нагрузок CapacityMathCoach:\nDAU -> Peak QPS (3x) -> Storage 5y -> 20% Hot RAM -> Network Gbps\nВалидация порядка величин (Order of Magnitude ±25%) + Вставка в решение"]
    end

    subgraph L2 ["🔍 L2: Faded Architectures (Поиск и устранение узких мест)"]
        F01["L2-01: Flash Sale Spike (RDB Crashing under 50k RPS -> Queue + Redis Cache)"]
        F02["L2-02: Celebrity / Hot Partition Problem (50M followers Fan-out on Read)"]
        F03["L2-03: Single Point of Failure (Active-Active Multi-Region Geo-DNS)"]
    end

    subgraph L3 ["🏛️ L3: Full-Scale BigTech Combat Designs (20 сценариев)"]
        C01["20 эталонных систем:\nTicketmaster, Uber H3, WhatsApp, Netflix CDN, Stripe Ledger, YouTube Video Ingestion..."]
    end

    L0 --> L1 --> L2 --> L3
```

---

## 3. System Design Compass (`Ctrl + /`)

Контекстная шторка-шпаргалка содержит:
1. **Numbers Every Systems Engineer Should Know (Задержки в 2026 году)**:
   * L1 cache reference: `0.5 ns`
   * RAM access: `100 ns`
   * NVMe SSD random read: `10-20 µs`
   * Data center round-trip (RTT): `0.5 ms`
   * Cross-continental RTT (EU -> US): `150 ms`
2. **CAP & PACELC Cheat Sheet**:
   * В случае разделения сети ($P$): выбор между доступностью ($A$) и согласованностью ($C$).
   * В штатном режиме ($E$): выбор между задержкой ($L$) и согласованностью ($C$).
3. **Дерево выбора хранилищ данных (Data Store Decision Tree)**:
   * OLTP ACID (PostgreSQL / CockroachDB) $\rightarrow$ Financial ledgers, ACID guarantees.
   * Key-Value (Redis / DynamoDB) $\rightarrow$ Caching, Session store, Rate limiting.
   * Append-Only Log / Event Streaming (Kafka) $\rightarrow$ Asynchronous decoupling, Event sourcing.
   * Analytical OLAP (ClickHouse / Snowflake) $\rightarrow$ Real-time aggregations, metrics, analytics.
4. **Consistent Hashing & Partitioning Rules** (MD5/Murmur3 ring, виртуальные ноды, перенос $1/N$ ключей).
5. **Cache Stampede Prevention** (SingleFlight Mutex, вероятностный алгоритм XFetch $\Delta \beta \ln(\text{rand}) > \text{TTL}$).

---

## 4. Интеграция с мультимодальным AI Tutor
- Вкладка **Staff AI** в `SystemDesignArena.tsx`:
  * Кандидат может обсудить архитектурные компромиссы (Trade-offs) с ИИ в роли **Google/Yandex Staff Architect**.
  * Прямой мост из компаса: кнопка «Спросить AI-тьютора» мгновенно переносит правило в контекст диалога.
  * Интеграция с `CapacityMathCoach`: кнопка «Вставить в решение» автоматически заносит расчеты в пояснительную записку архитектуры.

---

## 5. Критерии приемки (Definition of Done)
- [x] Разработаны 8 интерактивных микро-кат `L0` (`hld-micro-01` .. `hld-micro-08`).
- [x] Встроен калькулятор прикидок `L1` (`CapacityMathCoach.tsx`) с подсказками степеней 2 и 10 ($2^{10} \approx 10^3, 2^{20} \approx 10^6, 2^{30} \approx 10^9$) и валидацией $\pm 25\%$.
- [x] Реализованы 3 задачи на архитектурный рефакторинг готовых схем `L2` (`hld-faded-01` .. `hld-faded-03`).
- [x] Доступен **System Design Compass** по `Ctrl + /` (`SystemDesignCompassSheet.tsx`).
- [x] 0 ошибок сборки (`npm run build` в `frontend` и `backend`).
