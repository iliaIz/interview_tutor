# 06. Incident Triage Studio Specification

> **Версия**: 2.0 (Сентябрь 2026)  
> **Статус**: Production Ready  
> **Роут**: `/` -> Студия: Вкладка `triage` -> Вход в `IncidentTriageStudio`

---

## 1. Назначение и концепция
Режим расследования и локализации реальных инцидентов в распределенных высоконагруженных системах под жестким давлением времени (SRE, деградация latency, каскадные сбои, Deadlock в пуле соединений HikariCP, OOM, saturation потоков).

---

## 2. Диалоговый движок и роли ИИ
* **Транспорт**:
  * **Текстовый оперативный мост**: REST/SSE `/api/triage/probe`.
  * **Голосовой канал**: WebSocket `/ws/live?sessionType=triage` через `LiteLLM_Proxy`.
* **Роль ИИ**: SRE Incident Commander.
* **Стиль диалога**: Оперативный, четкий, ориентированный на минимизацию времени восстановления (MTTR). ИИ требует фальсифицируемых гипотез и блокирует хаотичные догадки.

---

## 3. Активный Компас: Triage Compass
* **Компонент**: `TriageCompassSheet.tsx` (Горячая клавиша: `Ctrl + /`).
* **5 Золотых Заповедей SRE**:
  1. **Golden Signals (RED / USE)**: Замер Rate, Errors, Duration (RED) и Utilization, Saturation, Errors (USE).
  2. **Blast Radius Containment**: Локализация радиуса поражения до начала глубокого дебага.
  3. **Mitigate First, Debug Second**: Сначала откатить релиз или включить Circuit Breaker, затем разбираться в причинах.
  4. **Telemetry Correlation**: Корреляция спайков задержек с логами исключений и трейсами OpenTelemetry.
  5. **Blameless Post-Mortem & Prevention**: Формирование превентивных мер для предотвращения рецидива.

---

## 4. Рабочее пространство и инструменты расследования
* **TriageProfilerArtifactView**: Анализатор дампов потоков (Thread Dumps) и логов с фильтрами (`BLOCKED`, `RUNNABLE`, `WAITING`), выделением локов и поиском по стектрейсам.
* **TriageHypothesisBoard**: Доска формулирования и фальсификации гипотез кандидатом.
* **TriageEvaluationModal**: Итоговый вердикт с оценкой правильности локализации первопричины (Root Cause) и полноты плана предотвращения.
