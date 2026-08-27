# System Architecture & Technical Specification: InterviewPrep AI (SOTA August 2026)

## 1. System Overview & End-to-End Topology

InterviewPrep AI is a real-time multimodal audio interview preparation platform for Java & Spring developers. All LLM, Audio WebSocket, and TTS interactions are strictly decoupled through a central AI Gateway (`LiteLLM_Proxy`).

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

---

## 2. Gemini Live Realtime Audio Protocol & Handshake

### 2.1. First-Turn Lockdown Invariant
* **Directive:** In all system prompts (`socratic_tutoring`, `adaptive_probing`, and `customPromptOverride`), the AI interviewer is strictly forbidden from invoking `submit_interview_evaluation` during Turn 0 (initial greeting).
* **Backend Guard:** The WebSocket session maintains `session.hasCandidateResponded = false`. Any premature invocation of `submit_interview_evaluation` is rejected with a structured `toolResponse` error, forcing the model to speak the greeting and read the question aloud.

### 2.2. Dual-Sided Handshake (Race Condition Elimination)
The transition from AI speech to candidate microphone (`isAiSpeaking: false`, `isRecording: true`) is symmetrically unblocked by whichever event finishes LAST:
1. `AudioPlayoutManager.onPlaybackFinished` (when physical audio finishes draining in headphones).
2. WebSocket `turnComplete: true` arrival (when network generation concludes).

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

---

## 3. Audio Lifecycle State Machine

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

## 4. Hardware Audio Architecture

### 4.1. Single-Sink Audio Routing
- **Mobile (Android/iOS):** Routes EXCLUSIVELY to `MediaStreamAudioDestinationNode` + HTML5 Audio element (`STREAM_MUSIC` loud speakerphone), bypassing `context.destination` to prevent dual-output echo.
- **Desktop:** Routes EXCLUSIVELY to `context.destination` for minimal latency (~10ms).

### 4.2. Tactile Barge-In
- Clicking the central interactive circle during AI speech invokes `AudioPlayoutManager.handleInterruption()` with a 5ms linear de-click ramp, stopping playback cleanly and switching UI to active recording (`isRecording: true`).

### 4.3. Non-Blocking Microphone Hardware Init
- `initMicrophoneHardware()` executes in an asynchronous background promise (`void initMicrophoneHardware()`).
- WebSocket connection and AI greeting audio are never blocked by operating system permission prompts.
