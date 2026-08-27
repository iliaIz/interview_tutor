# Architectural Guidelines & Invariants for InterviewPrep AI

## 1. LiteLLM Proxy Invariant (No Direct Provider Calls / No Hardcoded Keys)
- All LLM, Live Audio WebSocket, and TTS interactions MUST route strictly through `LiteLLM_Proxy` (`D:\projects\LiteLLM_Proxy` / `http://litellm-gateway:4000`) running in Docker:
  - HTTP REST endpoints: `${LITELLM_PROXY_URL}` (`http://host.docker.internal:4000/v1` or `http://localhost:4000/v1`).
  - Live Multimodal WebSocket endpoint: `ws://host.docker.internal:4000/ws/live?model=${GEMINI_LIVE_MODEL}&token=${LITELLM_API_KEY}`.
- NEVER hardcode Google API keys (`AQ.*`) or internal upstream model names (`gemini-2.5-flash-native-audio-latest`, etc.) in the application code.
- Always use environment variables:
  - `GEMINI_TEXT_MODEL` (e.g. `gemini-smart`)
  - `GEMINI_LIVE_MODEL` (e.g. `gemini-live` / `gemini-tts-live-v3`)
  - `GEMINI_TTS_MODEL` (e.g. `gemini-tts-v3`)
  - `LITELLM_API_KEY` (virtual key for proxy authorization)
- Dynamic model mapping, API key pool failover, and two-tier Circuit Breaker (Key 429 vs Model 503 Fast-Failover) are handled centrally by `LiteLLM_Proxy`.

---

## 2. Gemini Live Realtime Audio Architecture & State Machine

```mermaid
flowchart TD
    subgraph Client ["🖥️ Браузер кандидата (Frontend SPA)"]
        UI["🎨 Pastel Luxury UI / VoiceModal"]
        APM["🔊 AudioPlayoutManager (Web Audio API)"]
        VAD["🎙️ AudioCaptureProcessor (AudioWorklet 16kHz PCM)"]
        SM["🔄 Session State Machine (Dual-Sided Handshake)"]
        UI <--> SM
        SM --> APM
        SM <--> VAD
    end

    subgraph Edge ["🌐 Edge & Security Layer (VPS)"]
        Caddy["🛡️ Caddy 2.8 Reverse Proxy\n(Auto-HTTPS, HTTP/3, WS Upgrade)"]
    end

    subgraph BackendApp ["⚙️ Node.js Backend Container"]
        Express["🚀 Express REST API (/api/health, /api/eval)"]
        LiveProxy["📡 GeminiLiveProxy (/ws/live)"]
        SessionStore["💾 SQLite Database (746 Questions, Evaluations)"]
        Guard["🛡️ First-Turn Lockdown & Premature Tool Rejection"]
        LiveProxy <--> Guard
        LiveProxy <--> SessionStore
    end

    subgraph Gateway ["⚡ LiteLLM AI Gateway Container"]
        LLMGateway["LiteLLM Gateway (Port 4000)"]
        CircuitBreaker["2-Tier Circuit Breaker (Key 429 / Model 503)"]
        VirtualRegistry["Model Aliases (gemini-smart, gemini-live-v3, gemini-tts-v3)"]
        LLMGateway --- CircuitBreaker
        LLMGateway --- VirtualRegistry
    end

    subgraph Upstream ["☁️ Google Cloud AI"]
        GeminiLive["🎙️ Gemini Multimodal Live API (Bidirectional WS)"]
        GeminiFlash["⚡ Gemini Flash REST (Express Evaluation Fallback)"]
    end

    UI <-- "HTTPS / WSS" --> Caddy
    Caddy <-- "Proxy Pass (Port 5000)" --> LiveProxy
    Caddy <-- "REST" --> Express
    LiveProxy <-- "ws://litellm-gateway:4000/ws/live" --> LLMGateway
    Express <-- "http://litellm-gateway:4000/v1" --> LLMGateway
    LLMGateway <-- "TLS / GRPC" --> GeminiLive
    LLMGateway <-- "HTTPS" --> GeminiFlash
```

### 2.1. First-Turn Tool Lockdown Invariant
- **Strict Turn 0 Directive:** In all system prompts (`socratic_tutoring`, `adaptive_probing`, and `customPromptOverride`), the AI interviewer is strictly forbidden from invoking `submit_interview_evaluation` during the initial greeting turn.
- **Backend Premature Evaluation Rejection Guard:** The backend WebSocket session tracks `hasCandidateResponded`. If Gemini attempts to call `submit_interview_evaluation` when `hasCandidateResponded === false`, the backend rejects the call with a structured `toolResponse` error, forcing the model to speak the greeting and read the question aloud.

### 2.2. Dual-Sided Handshake Invariant (Race Condition Elimination)
- The transition from AI speech to candidate microphone (`isAiSpeaking: false`, `isRecording: true`) is symmetrically unblocked by whichever event finishes LAST:
  1. `AudioPlayoutManager.onPlaybackFinished` (when physical audio finishes draining in headphones).
  2. WebSocket `turnComplete: true` arrival (when network generation concludes).
- If audio drains before `turnComplete` arrives $\rightarrow$ `turnComplete` handler detects empty playout queue and immediately unlocks candidate mic.
- If `turnComplete` arrives before audio drains $\rightarrow$ `onPlaybackFinished` unlocks candidate mic upon physical timeline drain.

```mermaid
sequenceDiagram
    autonumber
    actor User as 👩‍💻 Кандидат
    participant Modal as 🖥️ VoiceModal (UI)
    participant APM as 🔊 AudioPlayoutManager
    participant Backend as ⚙️ Backend Proxy
    participant LiteLLM as ⚡ LiteLLM Gateway
    participant Gemini as 🎙️ Gemini Live Upstream

    User->>Modal: Клик «Начать собеседование»
    activate Modal
    Modal->>APM: playoutManager.resume() (В контексте жеста)
    Modal-)Modal: void initMicrophoneHardware() (Асинхронно в фоне)
    Modal->>Backend: WS Connect (/ws/live?strategy=socratic&turnMode=manual)
    deactivate Modal

    activate Backend
    Backend->>LiteLLM: WS Connect + SetupFrame (tools: [submit_interview_evaluation])
    LiteLLM->>Gemini: WS Setup Handshake
    Gemini-->>LiteLLM: setupComplete
    LiteLLM-->>Backend: setupComplete (UTF-8 JSON)
    
    rect rgb(255, 240, 245)
    Note over Backend,Gemini: 🛡️ ФАЗА 0: First-Turn Lockdown (Приветствие и вопрос)
    Backend->>Backend: session.hasCandidateResponded = false
    Backend->>Gemini: clientContent.turns: "Поприветствуй и зачитай вопрос..."
    Gemini-->>Backend: serverContent (Streaming 24kHz PCM Audio Chunks)
    Backend-->>Modal: Forward Audio Chunks
    Modal->>APM: enqueuePcmChunk(base64) -> Schedule on Web Audio Timeline
    APM-->>User: 🔊 «Привет! Чем различаются JRE, JVM и JDK?»
    Gemini-->>Backend: serverContent.turnComplete = true
    Backend-->>Modal: turnComplete = true
    end

    rect rgb(240, 255, 240)
    Note over Modal,APM: 🤝 Dual-Sided Handshake (Симметричное ожидание окончания звука)
    APM->>APM: Физический звук отзвучал в динамиках
    APM->>Modal: onPlaybackFinished() -> Видит isServerTurnComplete === true
    Modal->>Modal: setIsAiSpeaking(false) -> setIsRecording(true)
    Modal-->>User: 🟢 Кнопка «Передать ответ ➔», статус «🎙️ Ваша очередь»
    end

    rect rgb(255, 250, 240)
    Note over User,Modal: 🛑 Ручной режим (Manual Mode): Кандидат спокойно думает без риска перебивания
    User->>User: Размышление и формулирование ответа
    User->>Modal: Произносит ответ и нажимает «Передать ответ ➔»
    Modal->>Backend: clientContent: { turns: [User Answer], turnComplete: true }
    Backend->>Backend: session.hasCandidateResponded = true (Снятие блокировки оценки)
    end

    rect rgb(240, 248, 255)
    Note over Backend,Gemini: 🎯 ФАЗА 1: Анализ ответа / Сократический разбор
    Backend->>Gemini: clientContent (Кандидатский ответ)
    Gemini-->>Backend: toolCall: submit_interview_evaluation(score=92, isPassed=true...)
    Backend->>Backend: Валидация: hasCandidateResponded === true (Одобрено)
    Backend->>Backend: Сохранение в SQLite question_evaluations
    Backend->>Gemini: toolResponse: { status: "success" }
    Gemini-->>Backend: serverContent: Похвала голосом + feedback
    Backend-->>Modal: event: evaluation_completed + Audio Feedback
    Modal-->>User: 🏆 Оценка 92/100, структурированный фидбек и разбор
    end
```

### 2.3. Non-Blocking Hardware Initialization
- `initMicrophoneHardware()` executes in an asynchronous background promise (`void initMicrophoneHardware()`).
- WebSocket connection and AI greeting audio are NEVER blocked by operating system microphone permission prompts.

### 2.4. Single-Sink Audio Routing & Tactile Barge-In
- Mobile (Android/iOS): Routes EXCLUSIVELY to `MediaStreamAudioDestinationNode` + HTML5 Audio element to prevent dual-output echo and force speakerphone.
- Desktop: Direct Web Audio `context.destination` with low latency.
- Tactile Barge-In: User click on central circle during AI speech triggers `AudioPlayoutManager.handleInterruption()` with a 5ms de-click ramp, immediately silencing audio and switching UI to active recording.

---

## 3. Аудио Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> Lobby: Инициализация диалога
    
    Lobby --> Connecting: Клик «Начать собеседование»
    
    state Connecting {
        [*] --> ResumingAudio: Web Audio API resume
        ResumingAudio --> OpeningWS: Открытие сокета
        OpeningWS --> BackgroundMic: Фоновый прогрев MediaStream
    }
    
    Connecting --> Turn0_AiSpeaking: setupComplete + initialGreetingTurn
    
    state Turn0_AiSpeaking {
        [*] --> StreamingAudio: Прием чанков 24kHz PCM
        StreamingAudio --> PlayoutTimeline: Планирование на шкале AudioContext
        PlayoutTimeline --> AwaitingDrain: turnComplete получен от сервера
    }
    
    Turn0_AiSpeaking --> CandidateTurn: Dual-Sided Handshake (Очередь звука пуста && turnComplete)
    Turn0_AiSpeaking --> CandidateTurn: Тактильный Barge-In (Клик по центральному кругу)
    
    state CandidateTurn {
        [*] --> ManualReflection: Микрофон слушает (VAD изолирован)
        ManualReflection --> CandidateSpeaking: Речь кандидата
        CandidateSpeaking --> TransmittingAnswer: Клик «Передать ответ ➔»
    }
    
    CandidateTurn --> Thinking_Evaluating: turnComplete: true передан на бэкенд
    
    state Thinking_Evaluating {
        [*] --> WatchdogTimer: Старт таймера безопасности 6.5с
        WatchdogTimer --> ProbingOrEval: Gemini генерирует разбор / toolCall
        ProbingOrEval --> REST_Fallback: Срабатывание 6.5с таймаута (при лаге Live WS)
    }
    
    Thinking_Evaluating --> Verdict: evaluation_completed
    Thinking_Evaluating --> Turn0_AiSpeaking: Следующий вопрос в серии
    
    Verdict --> Lobby: Клик «Завершить»
    Verdict --> Turn0_AiSpeaking: 1-Click Retry «Ответить заново»
```

---

## 4. UI/UX Standard & Aesthetic Principles
- Target Audience: Soft luxury pastel aesthetics (`#FFF0F5`, lavender, rose, gentle mesh glow auras).
- Audio Session: 3-Stage flow (Lobby -> Active Session -> Verdict with 1-click retry).
- Health Monitoring: `/api/health` validates liveness AND checks the presence of all 4 required models (`GEMINI_TEXT_MODEL`, `GEMINI_LIVE_MODEL`, `GEMINI_TTS_MODEL`, `GEMINI_EMBEDDING_MODEL`) in the LiteLLM registry with latency metrics.

---

## 5. Turbo-Prefetching & Token Economy Invariant
- **User-Controlled Turbo Switch:** Speculative background prefetching is controlled by an explicit toggle in the Lobby (default: off).
- When enabled: the system pre-generates Challenge $N+1$ in a background buffer while the user solves Challenge $N$, delivering **0ms latency** on "Следующий вопрос".
- When disabled: strictly on-demand generation with zero wasted background tokens.

---

## 6. Cancellation Propagation & Zero Blank Screen Invariant
- **AbortSignal:** Closing the modal or clicking "Прервать" fires `AbortController.abort()`, which propagates to LiteLLM Proxy and cancels upstream Google generation to save quota tokens.
- **Recovery State Card:** In case of persistent network timeouts or provider cluster outages, the UI displays a structured Recovery Card with 3 actionable paths (Retry, Open Bank, Lobby), completely eliminating white blank screens.
- **Multi-Stack Curated Fallbacks:** The backend maintains battle-tested offline incident templates across all stack archetypes (`fintech_transactional`, `reactive_streaming`, `modern_cloud`, `enterprise_migration`).

