# Stage 05: Verification, Benchmarks & VPS Deployment

> **Статус:** ⬜ ЗАПЛАНИРОВАНО  
> **Ответственные файлы:**
> - [verifyPrompts.ts](file:///c:/projects/interview_tutor/backend/src/scripts/verifyPrompts.ts)
> - `backend/tests/`
> - `vps_info.md`
> - GitHub Actions / Deploy scripts

---

## 1. Задачи верификации и приёмочные критерии

1. **Unit-тестирование генерации системных промптов:**
   - Проверка включения `incidentContext`, `fixedCode`, `unitTest` в промпты `bug_hunt` и `free_chat`.
   - Проверка отсутствия обрезания ТЗ в `practice_pair`.
   - Проверка наличия топологии и заметок в `system_design`.
2. **WebSocket интеграционные тесты протокола:**
   - Верификация порядка кадров при Turn Handover Flush: фрейм кода с `turnComplete: false` обязан приходить строго перед терминальным `turnComplete: true`.
   - Проверка отсутствия лишних пауз или блокировок сокета при инжекции дейктических фреймов (`screen_context_sync`, `canvas_delta`).
3. **Бенчмарки задержки (Voice Latency SLA):**
   - Задержка между завершением речи пользователя и началом первого звукового чанка ИИ обязана оставаться **<400 мс** (Dual-Sided Handshake Invariant).
4. **Проверка мостовой памяти при навигации (Episodic Bridge Navigation):**
   - Переход между 3 кейсами Bug Hunt и возврат назад должен корректно восстанавливать реплики и формулировать 1-строчный мостик напоминания.
5. **Деплой на VPS (java.djelu.site):**
   - Синхронизация фронтенд и бэкенд бандлов, сборка Docker-контейнеров, проверка `/api/health` (все 4 модели и латентность) и сквозное ручное тестирование.

---

## 2. Чек-лист реализации

- [ ] **5.1.** Написать модульные тесты для расширенного `livePromptBuilder.ts` (покрытие всех новых веток).
- [ ] **5.2.** Провести локальные интеграционные тесты сокета с эмуляцией Handover Flush и смены вкладок.
- [ ] **5.3.** Провести аудит задержек (Latency Benchmarks) в режиме Auto-VAD с включенным расширенным мышлением (Thinking Mode).
- [ ] **5.4.** Собрать production-бандл фронтенда (`npm run build`) и проверить отсутствие TypeScript/ESLint регрессий.
- [ ] **5.5.** Развернуть изменения на VPS (`java.djelu.site`), проверить журналы `docker logs` и статус LiteLLM Proxy.
- [ ] **5.6.** Зафиксировать результаты в `walkthrough.md` и обновить `00_WAVE_06_MASTER_PLAN.md`.
