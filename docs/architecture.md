# System Architecture & Technical Specification: InterviewPrep AI (SOTA August 2026)

## 1. System Overview & Platform Topology

InterviewPrep AI is an advanced preparation studio for Java 21 & Spring developers featuring three unified learning and assessment pillars:
1. 🧠 **Knowledge Base & Voice Socratic Interviewer** (Real-time multimodal WebSocket with Gemini Live).
2. 🐛 **Production Incidents & Bug Simulator** (Live production incident debugging, root-cause analysis, and CVE detection).
3. ⚡ **Live-Coding, Katas & Machine Coding Studio** (Dual-pass AST static analysis + Gemini 3.7 Flash Senior evaluation, Multi-file workspace, OCP phased shifts, and Golden Master Approval Testing).

All LLM, Audio WebSocket, and TTS interactions are strictly routed through `LiteLLM_Proxy` (`http://litellm-gateway:4000`).

```mermaid
flowchart TD
    subgraph Client ["🖥️ Браузер кандидата (Frontend SPA) / Android & Desktop"]
        UI["🎨 StudioHeader & 3-Mode Navigation"]
        VoiceModal["🎙️ VoiceModal & AudioPlayoutManager (24kHz PCM)"]
        LiveIDE["💻 Live-Coding Workspace & Multi-File Tabs (4-Space Tab DX)"]
        IncidentHub["🐛 Production Incident & RCA Simulator"]
        AndroidAdapter["📱 Android Viewport Segment Switcher (Spec / Code)"]
        UI --- VoiceModal
        UI --- LiveIDE
        UI --- IncidentHub
        UI --- AndroidAdapter
    end

    subgraph Edge ["🌐 Edge & Security Layer (VPS djelu.site)"]
        Caddy["🛡️ Caddy 2.8 Reverse Proxy\n(Auto-HTTPS, HTTP/3, WebSocket Upgrade)"]
    end

    subgraph BackendApp ["⚙️ Node.js 22 Backend Container"]
        Express["🚀 Express REST API (/api/health, /api/practice, /api/eval)"]
        AST["🔍 AST Static Analyzer & Java 21 Text Block Stripper"]
        Evaluator["🧠 Dual-Pass AI Code Evaluator (AbortSignal 60s)"]
        LiveProxy["📡 GeminiLiveProxy (/ws/live)"]
        SessionStore["💾 SQLite Database (746 Questions, Coding Submissions, Vector Gaps)"]
        
        Express <--> AST
        AST <--> Evaluator
        Express <--> LiveProxy
        Express <--> SessionStore
    end

    subgraph Gateway ["⚡ LiteLLM AI Gateway Container"]
        LLMGateway["LiteLLM Gateway (Port 4000)"]
        CircuitBreaker["2-Tier Circuit Breaker (Key 429 / Model 503)"]
        IdempotentRegistry["Idempotent Model Registry (PostgreSQL Dedup)"]
        VirtualModels["Model Aliases (gemini-smart, gemini-fast, gemini-live-v2, gemini-tts-v3)"]
        LLMGateway --- CircuitBreaker
        LLMGateway --- IdempotentRegistry
        LLMGateway --- VirtualModels
    end

    subgraph Upstream ["☁️ Google Cloud AI"]
        GeminiLive["🎙️ Gemini Multimodal Live API (Bidirectional 24kHz PCM)"]
        GeminiSmart["🧠 Gemini 3.7 / 3.6 Flash (Extended Reasoning & Code Evaluation)"]
        GeminiTTS["🗣️ Gemini 3.1 Flash TTS (Multi-Voice Audio Recaps)"]
    end

    Client <-- "HTTPS / WSS" --> Caddy
    Caddy <-- "Proxy Pass (Port 5000)" --> Express
    Express <-- "ws://litellm-gateway:4000/ws/live" --> LLMGateway
    Express <-- "http://litellm-gateway:4000/v1" --> LLMGateway
    LLMGateway <-- "Bidirectional WS" --> GeminiLive
    LLMGateway <-- "HTTPS / REST (JSON Mode)" --> GeminiSmart
    LLMGateway <-- "REST Audio" --> GeminiTTS
```

---

## 2. Live-Coding & Machine Coding Studio Architecture

### 2.1. Dual-Pass Hybrid Code Evaluation Engine
The platform combines deterministic static analysis (Phase 1) with deep AI reasoning from `gemini-smart` (Phase 2) to eliminate hallucinations while capturing nuanced architectural insights.

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as 👩‍💻 Кандидат (Desktop / Android)
    participant IDE as 💻 WorkspaceEditor
    participant API as 🚀 Express Backend (/api/practice/evaluate)
    participant AST as 🔍 astAnalyzer.ts
    participant Eval as 🧠 codeEvaluator.ts
    participant Gateway as ⚡ LiteLLM (gemini-smart)
    participant DB as 💾 SQLite (coding_submissions)

    Candidate->>IDE: Нажатие «Запустить проверку (Senior AI Review)»
    IDE->>API: POST /api/practice/evaluate { challengeId, files, activePhase }
    activate API
    
    Note over API,AST: 1. Валидация нагрузки & Детерминированный AST-анализ
    API->>API: Проверка лимитов: макс. 15 файлов, макс. 200 КБ/файл
    API->>AST: analyzeWorkspaceFiles(files)
    AST->>AST: Сохранение текстовых блоков Java 21 (""") & Очистка комментариев
    AST->>AST: Извлечение сигналов: synchronized, Carrier Pinning, CountDownLatch, Layer Violations
    AST-->>API: AstAnalysisResult (санитизированный код + XML сигналов)
    
    Note over API,Gateway: 2. Структурированный AI-аудит (Gemini 3.7 Flash)
    API->>Eval: evaluateChallengeSubmission(preProcess, challenge, activePhase)
    Eval->>Gateway: POST /v1/chat/completions (model: gemini-smart, json_object, signal: 60s)
    Gateway->>Gateway: Gemini 3.7 Flash рассуждение (~1000 reasoning tokens)
    Gateway-->>Eval: JSON (compilationStatus, virtualExecutionResult, concurrencyAnalysis, scoreBreakdown)
    Eval->>Eval: Санитизация Markdown-оберток (```json) & Fallback defaults
    
    Note over API,DB: 3. Сохранение и обновление метрик дефицитов
    API->>DB: UPSERT INTO coding_submissions (score, evaluation_json, is_passed)
    API->>DB: recordNewErrorGap (Запись дефицитов в радар навыков)
    API-->>IDE: 200 OK { isPassed: true, evaluation: EvaluationResult }
    deactivate API

    IDE-->>Candidate: 🏆 Модальное окно оценки: метрики, вердикт, разбор JMM и SOLID
```

### 2.2. Scoring Formula & Rubric
The multi-dimensional evaluation calculates an overall score using industry-weighted criteria:
$$\text{Score} = 0.35 \cdot S_{\text{correctness}} + 0.25 \cdot S_{\text{concurrency}} + 0.25 \cdot S_{\text{architecture}} + 0.15 \cdot S_{\text{idioms}}$$

* **Functional Correctness (35%):** Simulation of test cases, boundary limits, and contract satisfaction.
* **Concurrency & Loom Safety (25%):** Thread safety under high contention, atomicity (`computeIfAbsent`), non-blocking locks, and carrier thread pinning prevention.
* **Architecture & SOLID (25%):** Dependency Inversion, single responsibility, OCP compliance, and clean separation of concerns.
* **Modern Java 21 Idioms (15%):** Adoption of Records, Sealed Interfaces, Pattern Matching for switch, and Virtual Threads.

---

## 3. Gemini Live Realtime Audio Protocol & Handshake

### 3.1. First-Turn Lockdown Invariant
* **Turn 0 Directive:** In all system prompts (`socratic_tutoring`, `adaptive_probing`), the AI interviewer is strictly forbidden from invoking `submit_interview_evaluation` during Turn 0 greeting.
* **Backend Guard:** The backend WebSocket session tracks `hasCandidateResponded`. If Gemini attempts to call `submit_interview_evaluation` when `hasCandidateResponded === false`, the backend rejects the call with a structured `toolResponse` error, forcing the model to speak the greeting and read the question aloud.

### 3.2. Dual-Sided Handshake
The transition from AI speech to candidate microphone (`isAiSpeaking: false`, `isRecording: true`) is symmetrically unblocked by whichever event finishes LAST:
1. `AudioPlayoutManager.onPlaybackFinished` (when physical audio finishes draining in headphones).
2. WebSocket `turnComplete: true` arrival (when network generation concludes).

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

## 4. Hardware Audio & Mobile Ergonomics

### 4.1. Single-Sink Audio Routing
* **Android / Mobile:** Routes exclusively to `MediaStreamAudioDestinationNode` + HTML5 Audio element (`STREAM_MUSIC` loud speakerphone), bypassing `context.destination` to prevent dual-output echo.
* **Desktop:** Routes exclusively to `context.destination` for minimal latency (~10ms).

### 4.2. Android Mobile Responsive Split
* On mobile screens (`< 768px`), `PracticeArena.tsx` renders a segmented pill switcher:
  - **[📄 Спека]:** Full problem description, DDD criteria, tiered hints, and Phase 2 OCP requirements.
  - **[💻 Код]:** Multi-file editor with Tab indentation (4 spaces) and execution controls.
