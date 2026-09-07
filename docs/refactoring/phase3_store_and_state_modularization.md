# Этап 3: Модуляризация Состояния (`useAppStore.ts`)

> **Цель:** Преобразовать 1036-строчный монолитный Zustand store `frontend/src/store/useAppStore.ts` в архитектуру изолированных слайсов (Zustand Slices Pattern), уменьшив каждый файл до 80–150 строк и сохранив 100% обратную совместимость для всех существующих компонентов.

---

## 1. Проблема монолитного Store

Сейчас в `useAppStore.ts` свалено всё:
- Состояние аутентификации пользователя (`user`, `token`, `role`).
- Каталог тем и текущих вопросов (`topics`, `activeTopicId`, `questions`).
- Настройки интервьюера (`persona`, `voice`, `turnMode`, `targetGrade`).
- Интерактивная доска кода (`activeWhiteboardState`, `setWhiteboardState`).
- Ревизии IDE в песочнице (`codeRevisions`, `activeRevisionId`).
- Чекпоинты пакетного прохождения (`activeBatchSession`, `saveBatchSessionCheckpoint`).
- Глобальный плеер аудиоподкастов (`currentAudioPodcast`, `isPlayingPodcast`).
- Всплывающие уведомления (`toasts`, `showToast`).

**Последствия:** Любое добавление поля или метода в стор приводит к чтению 1000 строк и риску сломать соседнюю несвязанную подсистему.

---

## 2. Архитектура Zustand Slices

Zustand поддерживает стандартный паттерн композиции слайсов без изменения контракта вызова:

```
frontend/src/store/
├── types.ts                     # Общие интерфейсы AppState и AppActions
├── slices/
│   ├── createAuthSlice.ts       (~80 строк)  --> пользователь, роли, вход/выход
│   ├── createTopicSlice.ts      (~130 строк) --> темы, фильтрация, активный вопрос
│   ├── createWhiteboardSlice.ts (~140 строк) --> интерактивная доска, ревизии кода
│   ├── createBatchSlice.ts      (~110 строк) --> чекпоинты пакетного интервью
│   ├── createAudioPlayerSlice.ts(~95 строк)  --> плеер подкастов тем
│   └── createToastSlice.ts      (~60 строк)  --> тосты и системные уведомления
│
└── useAppStore.ts               (~70 строк)  --> композиция через `create<AppState>()(...)`
```

---

## 3. Реализация паттерна Slices

Пример сборки в `useAppStore.ts`:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppState } from './types';
import { createAuthSlice } from './slices/createAuthSlice';
import { createTopicSlice } from './slices/createTopicSlice';
import { createWhiteboardSlice } from './slices/createWhiteboardSlice';
import { createBatchSlice } from './slices/createBatchSlice';
import { createAudioPlayerSlice } from './slices/createAudioPlayerSlice';
import { createToastSlice } from './slices/createToastSlice';

export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createAuthSlice(...a),
      ...createTopicSlice(...a),
      ...createWhiteboardSlice(...a),
      ...createBatchSlice(...a),
      ...createAudioPlayerSlice(...a),
      ...createToastSlice(...a),
    }),
    {
      name: 'interview-prep-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        activeTopicId: state.activeTopicId,
        activeBatchSession: state.activeBatchSession
      })
    }
  )
);

// Сохраняем все селекторы для обратной совместимости
export * from './types';
```

---

## 4. Преимущества для разработки и ИИ

1. **Изоляция:** Если нам нужно добавить фичу в интерактивную доску (Whiteboard), ИИ открывает только `createWhiteboardSlice.ts` (140 строк) и не видит логику плеера или авторизации.
2. **Нулевая регрессия:** Все существующие вызовы вида:
   ```typescript
   const { activeWhiteboardState, setWhiteboardState } = useAppStore();
   const showToast = useAppStore((s) => s.showToast);
   ```
   продолжают работать **без единого изменения** в коде потребителей!

---

## 5. Definition of Done (DoD) для Этапа 3

- [ ] Ни один файл слайса не превышает 160 строк.
- [ ] Головной файл `useAppStore.ts` не превышает 90 строк.
- [ ] Все компоненты проекта успешно собираются через `npm run build`.
- [ ] Данные пользователя, прогресс тем и чекпоинты сохраняются в localStorage как и раньше.
