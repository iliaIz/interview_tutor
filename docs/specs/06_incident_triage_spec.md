# 06. Incident Triage Studio Specification

## Назначение
Режим расследования и локализации инцидентов в распределенных системах под давлением времени (SRE, деградация latency, каскадные сбои, OOM, saturation пулов соединений).

## Диалоговый движок
* **Транспорт**: WebSocket `/ws/live?sessionType=triage`.
* **Роль ИИ**: SRE Incident Commander.
* **Стиль диалога**: Быстрый, оперативный, ориентированный на восстановление доступности (MTTR).

## Активный Компас
* **Компонент**: `TriageCompassSheet.tsx` (Горячая клавиша: `Ctrl + /`).
* **5 Золотых Заповедей SRE**:
  1. Golden Signals (Latency, Traffic, Errors, Saturation).
  2. Blast Radius Containment (Локализация зоны поражения).
  3. Rollback First, Root Cause Second (Сначала откат/смягчение, потом дебаг).
  4. Telemetry Correlation (Корреляция метрик, логов и распределенных трейсов).
  5. Blameless Post-Mortem (Выводы и превентивные меры).

## Инструменты и рабочее пространство
* **Интерактивные терминалы**: Логи, Prometheus-метрики, графы задержек.
