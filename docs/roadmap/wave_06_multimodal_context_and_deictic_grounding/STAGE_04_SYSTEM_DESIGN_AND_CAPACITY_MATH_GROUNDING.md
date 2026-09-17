# Stage 04: System Design & Capacity Math Grounding

> **Статус:** ⬜ ЗАПЛАНИРОВАНО  
> **Ответственные файлы:**
> - [SystemDesignArena.tsx](file:///c:/projects/interview_tutor/frontend/src/components/system_design/SystemDesignArena.tsx)
> - [ArchitectureCanvas.tsx](file:///c:/projects/interview_tutor/frontend/src/components/system_design/canvas/ArchitectureCanvas.tsx)
> - [LoadSimulationWorker.ts](file:///c:/projects/interview_tutor/frontend/src/components/system_design/simulation/LoadSimulationWorker.ts)
> - [CapacityMathCoach.tsx](file:///c:/projects/interview_tutor/frontend/src/components/system_design/CapacityMathCoach.tsx)
> - [liveWsConnectionHandler.ts](file:///c:/projects/interview_tutor/backend/src/services/live/liveWsConnectionHandler.ts)

---

## 1. Проблема и выявленные дефекты (As-Is)

1. **Слепота к начальному состоянию холста:**
   Если кандидат спроектировал архитектуру на интерактивном холсте *до* включения микрофона и нажатия «Начать устную защиту», в `handleStartVoiceDefense()` передаётся только название сценария и базовое ТЗ. Начальная топология холста в системный промпт не попадает. Bar-Raiser считает, что схема пуста, пока кандидат вручную не сдвинет ноду.
2. **Полная слепота в режиме Mermaid и заметок кандидата:**
   Если выбран режим `architectureMode === 'mermaid'` или кандидат пишет пояснительную записку в `designNotes` (по шардированию, кэшированию и CAP), эти данные никогда не отправляются в сокет Bar-Raiser'а.
3. **Отсутствие аномальной телеметрии симулятора:**
   Web Worker [LoadSimulationWorker.ts](file:///c:/projects/interview_tutor/frontend/src/components/system_design/simulation/LoadSimulationWorker.ts) вычисляет узлы с перегрузкой, процент потерь и лаги. На экране ноды горят красным, но Bar-Raiser не видит этого и не может атаковать узкие места.
4. **Статичность входных значений в Capacity Math Coach:**
   Если кандидат меняет значения в полях ввода (Пиковый QPS, Хранилище, Кэш RAM) прямо во время разговора с тьютором, сокет не получает обновления.

---

## 2. Архитектура целевого решения (To-Be)

### 2.1. Передача начальной топологии и заметок при старте защиты
В `handleStartVoiceDefense()` передавать агрегированный начальный сниппет:
```typescript
const currentTopologyMermaid = architectureMode === 'canvas' 
  ? convertCanvasToMermaid(nodes, edges)
  : mermaidCode;

await startVoiceSession({
  sessionType: 'system_design',
  topic: activeSystemDesignScenario.title,
  questionText: activeSystemDesignScenario.title,
  referenceAnswer: activeSystemDesignScenario.contextMarkdown,
  scenarioId: activeSystemDesignScenario.id,
  codeSnippet: currentTopologyMermaid,
  // Заметки кандидата:
  customPrompt: designNotes ? `=== ПОЯСНИТЕЛЬНАЯ ЗАПИСКА КАНДИДАТА ПО АРХИТЕКТУРЕ ===\n${designNotes}\n` : undefined
});
```

### 2.2. Двухуровневый семантический фильтр телеметрии (Semantic Anomaly Digest)
1. **Фоновый пульс (раз в 20 секунд или при стабилизации топологии):**
   ```text
   [ТЕЛЕМЕТРИЯ СЕТИ]: Входной поток: 50k RPS. Успешность: 99.4%. p99: 45мс. Все узлы в норме.
   ```
2. **Аварийный триггер аномалий (отправляется мгновенно при пересечении порогов):**
   ```text
   🚨 [АНОМАЛИЯ ХОЛСТА: БОТЛНЕК НА УЗЛЕ "PostgreSQL Cluster"]:
   Нагрузка: 18,000 RPS. Дроп: 38% запросов! 
   Причина: исчерпан пул соединений, p99 задержка выросла до 2.4 сек.
   ```

### 2.3. Live Sync полей в Capacity Math Coach
При изменении чисел в инпутах симулятора (с debounce 800 мс) отправлять короткий дейктический фрейм:
```text
📊 [ОБНОВЛЕНИЕ РАСЧЕТОВ КАНДИДАТА НА ЭКРАНЕ]:
- Введенный Пиковый QPS: ${userPeakQps}
- Введенное Хранилище: ${userStorageTb} TB
- Введенный Кэш RAM: ${userHotRamGb} GB
```

---

## 3. Чек-лист реализации

- [ ] **4.1.** Передавать начальную топологию графа и `designNotes` при старте устной защиты в [SystemDesignArena.tsx](file:///c:/projects/interview_tutor/frontend/src/components/system_design/SystemDesignArena.tsx).
- [ ] **4.2.** Добавить дебаунс-синхронизацию изменений `mermaidCode` и `designNotes` в режиме ручного кода.
- [ ] **4.3.** Реализовать в `LoadSimulationWorker` / `ArchitectureCanvas` детектор критических аномалий (дроп > 5%, насыщение > 85%) и отправку алерта через `sendCanvasDelta`.
- [ ] **4.4.** Добавить в [CapacityMathCoach.tsx](file:///c:/projects/interview_tutor/frontend/src/components/system_design/CapacityMathCoach.tsx) отправку дельты введённых расчётов при редактировании полей.
